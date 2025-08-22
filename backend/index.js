import { request, gql } from "graphql-request";
import enviarEmail from "./send.js";
import salvarExcelAlertas from "./alertExcel.js";
import { getURL, readURL, deleteJSON } from "./crudJson.js";

// ==== CONFIG ====
const endpoint = "https://runningland.com.br/graphql";
const INPUT_FILE = "url.json";
const LIMITE = 10;
const LIMITE_ESTOQUE = 50; // Limite para disparar alerta
const ALERTAS = []; // Array para armazenar alertas de estoque baixo
const CARRINHO_FECHADO = [];

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

async function searchData(urlKey) {
  try {
    const data = await request(endpoint, Products, { urlKey });

    const produto = data.products.items[0];

    if (!produto || !produto.related_products) {
      console.log(`Carrinho Fechado: ${urlKey}`);
      CARRINHO_FECHADO.push(urlKey);
      return null;
    }

    const alertas = await processarAlertas(produto);
    if (alertas) {
      ALERTAS.push(...alertas);
    }
    return data;
  } catch (err) {
    console.error(`❌ Erro ao processar ${urlKey}:`, err.message);
    throw new Error(`Erro ao consultar ${urlKey}: ${err.message}`);
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

// Versão melhorada e SIMPLES
async function processarAlertas(produto) {
  try {
    const alertasProduto = [];
    const alerta = [];

    const { related_products } = produto;

    related_products.forEach((element) => {
      if (element.name && element.name.toLowerCase().includes("patrocinador"))
        return;

      if (!element.items) return; // Verificação de segurança

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
          item.title &&
          item.title.toLowerCase().trim().includes("personalizaçãodecamiseta")
        )
          return;
        if (item.title && item.title.toLowerCase().includes("viseira")) return;

        if (!item.options) return; // Verificação de segurança

        item.options.forEach((option) => {
          if (option.quantity < LIMITE_ESTOQUE) {
            alerta.push({
              Product: element.name,
              label: option.label,
              quantity: option.quantity,
            });
          }
        });
      });
    });

    if (alerta.length > 0) {
      alertasProduto.push({
        evento: produto.name,
        ProdutosAlertas: alerta,
      });
    }

    return alertasProduto.length > 0 ? alertasProduto : null;
  } catch (err) {
    console.error(
      `❌ Erro ao processar alertas para ${produto.name}:`,
      err.message
    );
    return null;
  }
}

async function relatorio(alertas) {
  try {
    if (!alertas || alertas.length === 0) {
      console.log("Nenhum alerta de estoque baixo encontrado.");
      return ["", "Nenhum alerta de estoque baixo encontrado."];
    }

    const resultado = [];
    let message = "";
    message += `Alerta de estoque:\n\n`;

    for (let i = 0; i < alertas.length; i++) {
      const vistos = new Set();
      const produtosUnicos = [];
      message += `Evento: ${alertas[i].evento}\n`;

      for (let j = 0; j < alertas[i].ProdutosAlertas.length; j++) {
        const produto = alertas[i].ProdutosAlertas[j];
        const key = `${produto.label}-${produto.quantity}`;

        if (!vistos.has(key)) {
          message += `  • Produto: ${produto.label}, Quantidade: ${produto.quantity}\n`;
          produtosUnicos.push({
            nome: produto.label,
            quantidade: produto.quantity,
          });
          vistos.add(key);
        }
      }
      message += `\n`;

      resultado.push({
        evento: alertas[i].evento,
        produtos: produtosUnicos,
      });
    }

    return [resultado, message];
  } catch (err) {
    console.error("Erro ao gerar relatorio:", err.message);
    return ["", "Erro ao gerar relatório de alertas."];
  }
}

async function disparaEmail() {
  try {
    if (ALERTAS.length === 0) {
      console.log("Nenhum alerta para enviar por email.");
return;}
    const [alertasData, corpo] = await relatorio(ALERTAS);
    const assunto = "Relatório de Alertas de Estoque";
    const destinatarios = ["raissa.lima@nortemkt.com"];
    await enviarEmail(destinatarios, assunto, corpo);
    console.log("Email de alertas enviado com sucesso!");
  } catch (err) {
    console.error("Erro ao disparar email:", err.message);
  }
}

// ==== EXECUÇÃO PRINCIPAL ====

async function Monitoramento() {
  try {
    console.log("Iniciando monitoramento de estoque...");

    await getURL();
    const urls = await readURL(INPUT_FILE);
    console.log(`Processando ${urls.length} URLs...`);

    await concurrency(urls, LIMITE);
    console.log(
      `Processamento concluído. ${ALERTAS.length} alertas encontrados.`
    );

    if (ALERTAS.length > 0) {
      await disparaEmail();
    } else {
      console.log("Nenhum alerta de estoque baixo encontrado.");
    }

    await deleteJSON(INPUT_FILE);
    console.log("Monitoramento finalizado com sucesso!");
  } catch (err) {
    console.error("Erro ao iniciar o monitoramento:", err.message);
  }
}

Monitoramento();
