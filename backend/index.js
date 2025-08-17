import { request, gql } from "graphql-request";
import pool from "./database.js";
import QUERY_BD from "./queryBD.js";
import fs from "fs/promises";
import enviarEmail from "./send.js";
import salvarExcelAlertas from "./alertExcel.js";

// ==== CONFIG ====
const endpoint = "https://runningland.com.br/graphql";
const INPUT_FILE = "url.json";
const LIMITE = 10;
const LIMITE_ESTOQUE = 100; // Limite para disparar alerta

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

    // Verifica alertas de estoque
    const temAlertas = processarAlertas(produto);

    // Adiciona ao array MESSAGE
    MESSAGE.push({
      url_key: urlKey,
      evento: produto.name,
      tem_alertas: temAlertas,
      timestamp: new Date().toISOString(),
    });

    return data;
  } catch (err) {
    console.error(`❌ Erro ao processar ${urlKey}:`, err.message);
    throw new Error(`Erro ao consultar ${urlKey}: ${err.message}`);
  }
}

// Função para processar alertas de estoque

// Versão melhorada e SIMPLES
function processarAlertas(produto) {
  
}

// Função para gerar relatório de alertas
function gerarRelatorioAlertas() {
  if (ALERTAS.length === 0) {
    return null;
  }

  let relatorio = `🚨 RELATÓRIO DE ALERTAS DE ESTOQUE\n`;
  relatorio += `📅 Data: ${new Date().toLocaleString("pt-BR")}\n`;
  relatorio += `📊 Total de eventos com alertas: ${ALERTAS.length}\n`;
  relatorio += `${"=".repeat(50)}\n\n`;

  // ALERTAS.forEach((items, index) => {
  //   items.Products.forEach((item) => {
  //     if (item.evento) {
  //       relatorio += `Evento: ${item.evento}\n`;
  //     } else if (item.name) {
  //       relatorio += `Nome: ${item.name}\n`;
  //     } else if (item.Produtos && item.quantidade) {
  //       relatorio += `Produto: ${item.Produtos} - Quantidade: ${item.quantidade}\n`;
  //     }
  //   });
  // });

  // console.log(relatorio)
  return relatorio;
}

// Função para enviar email de alerta
async function enviarEmailAlerta() {
  if (ALERTAS.length === 0) {
    console.log("✅ Nenhum alerta de estoque encontrado");
    return;
  }

  try {
    const relatorio = gerarRelatorioAlertas();
    const assunto = `🚨 Alerta de Estoque Baixo - ${ALERTAS.length} evento(s)`;

    // Usando a estrutura correta da sua função enviarEmail
    // const destinatarios = ['alexandre.braga@nortemkt.com','otavio.michelato@nortemkt.com','cesar.vital@nortemkt.com']
    const destinatarios = ["po82184@gmail.com"];
    for (let i = 0; i < destinatarios.length; i++) {
      await enviarEmail(
        destinatarios[i],
        assunto,
        relatorio,
        "alerta_estoque.xlsx",
        ALERTAS
      );
    }

    console.log(
      `📧 Email de alerta enviado! ${ALERTAS.length} evento(s) com estoque baixo`
    );

    // Salva log dos alertas
    await fs.writeFile(
      "alertas_estoque.json",
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          total_alertas: ALERTAS.length,
          alertas: ALERTAS,
        },
        null,
        2
      ),
      "utf-8"
    );
  } catch (error) {
    console.error("❌ Erro ao enviar email de alerta:", error.message);
  }
}

async function concurrency(list, limit) {
  let index = 0;
  const results = [];
  const errors = [];

  async function worker() {
    while (true) {
      let currentIndex;
      if (index >= list.length) break;
      currentIndex = index++;
      if (currentIndex >= list.length) break;
      const urlkey = list[currentIndex];

      try {
        const result = await searchData(urlkey);
        if (result) {
          results.push({ urlkey, data: result });
        }
      } catch (err) {
        errors.push({ urlkey, error: err.message });
      }
    }
  }

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
  return { results, errors };
}

// ==== EXECUÇÃO PRINCIPAL ====
try {
  console.log("🚀 Iniciando monitoramento de estoque...");

  // await getURL();
  // const list = await readURL(INPUT_FILE);
  // const { results, errors } = await concurrency(list, LIMITE);
  await searchData("blue-run-pinhais-2025");

  // Envia email apenas se houver alertas
  await enviarEmailAlerta();
  // Limpa arquivo temporário
  // await deleteJSON(INPUT_FILE);

  // Resumo final
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMO DA EXECUÇÃO");
  console.log("=".repeat(60));
  console.log(`✅ Produtos processados: ${results.length}`);
  console.log(`❌ Erros encontrados: ${errors.length}`);
  console.log(`🚨 Eventos com alertas: ${ALERTAS.length}`);
  console.log(`📧 Email enviado: ${ALERTAS.length > 0 ? "SIM" : "NÃO"}`);
  console.log("=".repeat(60));
} catch (error) {
  console.error("❌ Erro na execução principal:", error.message);
}
