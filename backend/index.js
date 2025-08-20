import { request, gql } from "graphql-request";
import pool from "./database.js";
import QUERY_BD from "./queryBD.js";
import fs from "fs/promises";
import enviarEmail from "./send.js";
import salvarExcelAlertas from "./alertExcel.js";
import { constants } from "buffer";
import { Console } from "console";

// ==== CONFIG ====
const endpoint = "https://runningland.com.br/graphql";
const INPUT_FILE = "url.json";
const LIMITE = 10;
const LIMITE_ESTOQUE = 50; // Limite para disparar alerta

const MESSAGE = [];
const ALERTAS = []; // Array para armazenar alertas de estoque baixo

const Products = gql`
  query Products($urlKey: String!) {
    products(filter: { url_key: { eq: $urlKey } }) {
      total_count
      items {
        __typename
        ... on SimpleProduct {
          id
          name
          sku
          url_key
          stock_status
          related_products {
            id
            name
            sku
            stock_status

            # Para produtos Bundle (que contêm outros produtos)
            ... on BundleProduct {
              items {
                title
                options {
                  id
                  label
                  quantity
                  product {
                    name
                    sku
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function getURL() {
  try {
    const [rows] = await pool.query(QUERY_BD.query_URL);
    await saveJSON(rows);
    return rows;
  } catch (err) {
    throw new Error("Error ao consultar dados do banco de dados!");
  }
}

async function saveJSON(rows) {
  try {
    const data = await fs.writeFile(
      "url.json",
      JSON.stringify(rows, null, 2),
      "utf-8"
    );
    console.log("Arquivo salvo!");
    return data;
  } catch (err) {
    throw new Error("Error ao salvar query no json!");
  }
}

async function readURL(path) {
  try {
    const data = await fs.readFile(path, "utf-8");
    const response = JSON.parse(data);
    const list = response.map((e) => e.URL);
    return list;
  } catch (e) {
    throw new Error("Não foi possivel ler arquivo json");
  }
}

async function deleteJSON(path) {
  try {
    const data = await fs.unlink(path);
    console.log("Arquivo excluido");
    return data;
  } catch (err) {
    throw new Error("Error ao deletar json!");
  }
}

async function searchData(urlKey) {
  try {
    const data = await request(endpoint, Products, { urlKey });

    const produto = data.products.items[0];

    if (!produto) {
      console.log(`❌ Produto não encontrado: ${urlKey}`);
      return null;
    }

    const alertas = await processarAlertas(produto);
    const relatorioo = await relatorio(alertas);
    console.log(relatorioo);
    return data;
  } catch (err) {
    console.error(`❌ Erro ao processar ${urlKey}:`, err.message);
    throw new Error(`Erro ao consultar ${urlKey}: ${err.message}`);
  }
}

// Função para processar alertas de estoque

// Versão melhorada e SIMPLES
async function processarAlertas(produto) {
  try {
    const alertasProduto = [];
    const alerta = [];

    const { related_products } = await produto;

    related_products.forEach((element) => {
      if (element.name && element.name.toLowerCase().includes("patrocinador"))
        return;
      element.items.forEach((item) => {
        if (item.title && item.title.toLowerCase().includes("termo")) return;
        if (item.title && item.title.toLowerCase().includes("distância"))
          return;
        if (item.title && item.title.toLowerCase().includes("bateria")) return;
        if (item.title && item.title.toLowerCase().includes("moletom")) return;
        if (item.title && item.title.toLowerCase().includes("mochila")) return;
        if (item.title && item.title.toLowerCase().includes("boné")) return;
        if (item.title && item.title.toLowerCase().includes("jaqueta")) return;
        if (item.title && item.title.toLowerCase().includes("aceite")) return;
        if (
          item.title &
          item.title.toLowerCase().trim().includes("personalizaçãodecamiseta")
        )
          return;
        if (item.title && item.title.toLowerCase().includes("viseira")) return;
        item.options.forEach((option) => {
          if (option.quantity < LIMITE_ESTOQUE) {
            alerta.push({
              Product: element.name,
              name: option.product.name,
              label: option.label,
              quantity: option.quantity,
            });
          }
        });
      });
    });

    alertasProduto.push({
      evento: produto.name,
      ProdutosAlertas: [...new Set(alerta)],
    });
    return alertasProduto.length > 0 ? alertasProduto : null;
  } catch (err) {
    console.error(
      `❌ Erro ao processar alertas para ${produto.name}:`,
      err.message
    );
  }
}

async function relatorio(alertas) {
  try {
    let relatorio = "";

    if (alertas.length == 0 || alertas.length == [] || alertas == null) {
      console.log("Nenhum alerta de estoque baixo encontrado.");
      return;
    }

    for (let i = 0; i < alertas.length; i++) {
      relatorio += ` Evento: ${alertas[i].evento}\n`;
      relatorio += "  Produtos com estoque baixo:\n";
      for (let j = 0; j < alertas[i].ProdutosAlertas.length; j++) {
        if (
          alertas[j].ProdutosAlertas[j].label ==
            alertas[j].ProdutosAlertas[j].label &&
          alertas[j].ProdutosAlertas[j].quantity ==
          alertas[j].ProdutosAlertas[j].quantity
        ) {
          return;
        }
          relatorio += `  - Nome: ${alertas[i].ProdutosAlertas[j].label} | Quantidade: ${alertas[i].ProdutosAlertas[j].quantity}\n`;
      }
    }
    return relatorio;
  } catch (err) {
    console.error("Erro ao gerar relatorio:", err.message);
  }
}

async function concurrency(list, limit) {
  let index = 0;

  async function worker() {
    while (true) {
      let currentIndex;
      if (index >= list.length) break;
      currentIndex = index++;
      if (currentIndex >= list.length) break;
      const urlkey = list[currentIndex];

      try {
        await searchData(urlkey);
      } catch (err) {
        throw new Error(`Erro ao buscar dados para ${urlkey}: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  return;
}

// ==== EXECUÇÃO PRINCIPAL ====

async function Monitoramento() {
  try {
    await getURL();
    const urls = await readURL(INPUT_FILE);
    await concurrency(urls, LIMITE);
    await deleteJSON(INPUT_FILE);
    return;
  } catch (err) {
    console.error("Erro ao iniciar o monitoramento:", err.message);
  }
}

Monitoramento();
