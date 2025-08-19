import { request, gql } from "graphql-request";
import pool from "./database.js";
import QUERY_BD from "./queryBD.js";
import fs from "fs/promises";
import enviarEmail from "./send.js";
import salvarExcelAlertas from "./alertExcel.js";
import cron from "node-cron";

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

// Função para processar alertas de estoque
function processarAlertas(produto, nomeEvento) {
  const alertasProduto = [];

  // Verifica produtos relacionados (onde está o quantity)
  if (produto.related_products) {
    produto.related_products.forEach((produtoRelacionado) => {
      // FILTRO: Ignora produtos patrocinadores pelo nome do produto relacionado
      if (
        produtoRelacionado.name &&
        produtoRelacionado.name.toLowerCase().includes("patrocinador")
      ) {
        return; // Pula todo o produto relacionado se for patrocinador
      }

      // Verifica items do bundle se existir
      if (produtoRelacionado.items) {
        produtoRelacionado.items.forEach((item) => {
          // Filtros para itens que devem ser ignorados
          if (item.title && item.title.toLowerCase().includes("bateria"))return;
          if (item.title && item.title.toLowerCase().includes("distância"))return;
          if (item.title && item.title.toLowerCase().includes("termo")) return;
          if (item.title && item.title.toLowerCase().includes("aceite")) return;
          if (item.title && item.title.toLowerCase().includes("jaqueta"))return;
          if (item.title && item.title.toLowerCase().includes("boné")) return;
          if (item.title && item.title.toLowerCase().includes("moletom"))return;

          if (item.options) {
            item.options.forEach((option) => {
              const quantidade = option.quantity || 0;
              if (quantidade <= LIMITE_ESTOQUE) {
                alertasProduto.push({
                  nome: `${produtoRelacionado.name} - ${item.title} - ${option.label}`,
                  sku: produtoRelacionado.sku,
                  estoque: quantidade,
                  tipo: "bundle_option",
                  produto_id: produtoRelacionado.id,
                });
              }
            });
          }
        });
      }
    });
  }

  // Se houver alertas, adiciona ao array global
  if (alertasProduto.length > 0) {
    ALERTAS.push({
      evento: nomeEvento,
      url_key: produto.url_key,
      alertas: alertasProduto,
      timestamp: new Date().toISOString(),
    });
  }

  return alertasProduto.length > 0;
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
    const temAlertas = processarAlertas(produto, produto.name);

    // Gera a mensagem formatada
    const message = formatEventMessage(data, temAlertas);
    console.log("\n" + "=".repeat(60));
    console.log(`EVENTO: ${urlKey} ${temAlertas ? "🚨 ALERTA ESTOQUE" : "✅"}`);
    console.log("=".repeat(60));
    console.log(message);

    // Adiciona ao array MESSAGE
    MESSAGE.push({
      url_key: urlKey,
      evento: produto.name,
      status: produto.stock_status,
      timestamp: new Date().toISOString(),
      produtos: produto.related_products || [],
      mensagem_formatada: message,
      tem_alertas: temAlertas,
    });

    return data;
  } catch (err) {
    console.error(`❌ Erro ao processar ${urlKey}:`, err.message);
    throw new Error(`Erro ao consultar ${urlKey}: ${err.message}`);
  }
}

function formatEventMessage(dataProduct, temAlertas = false) {
  try {
    const product = dataProduct.products.items[0];

    if (!product) {
      return "❌ Produto não encontrado";
    }

    // Informações básicas do evento
    const eventName = product.name;
    let message = `🏃‍♂️ **${eventName}** ${temAlertas ? "🚨" : ""}\n\n`;

    // Processa produtos relacionados
    if (product.related_products && product.related_products.length > 0) {
      let kitIndex = 1;

      product.related_products.forEach((element) => {
        // FILTRO: Ignora produtos patrocinadores pelo nome do produto relacionado
        if (
          element.name &&
          element.name.toLowerCase().includes("patrocinador")
        ) {
          return; // Pula todo o produto relacionado se for patrocinador
        }

        // Se for Bundle Product com opções
        if (element.items && element.items.length > 0) {
          element.items.forEach((item) => {
            // Ignora completamente itens relacionados a bateria
            if (item.title && item.title.toLowerCase().includes("bateria")) {
              return; // Pula este item na exibição
            }
            if (item.title && item.title.toLowerCase().includes("distância")) {
              return;
            }
            if (item.title && item.title.toLowerCase().includes("termo")) {
              return;
            }
            if (item.title && item.title.toLowerCase().includes("aceite")) {
              return;
            }
            if (item.title && item.title.toLowerCase().includes("jaqueta")) {
              return;
            }
            if (item.title && item.title.toLowerCase().includes("boné")) {
              return;
            }
            if (item.title && item.title.toLowerCase().includes("moletom")) {
              return;
            }

            message += `    ${item.title}\n`;

            if (item.options && item.options.length > 0) {
              item.options.forEach((option) => {
                const quantity = option.quantity || 0;
                const alert = quantity <= LIMITE_ESTOQUE ? " 🚨" : "";
                message += `    ${option.label}: ${quantity}${alert}\n`;
              });
            }
            message += `\n`;
          });
        }
      });
    }

    return message;
  } catch (error) {
    console.error("Erro ao formatar mensagem:", error);
    return `❌ Erro ao processar dados: ${error.message}`;
  }
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

  ALERTAS.forEach((evento, index) => {
    relatorio += `${index + 1}. 🏃‍♂️ ${evento.evento}\n\n`;

    // Agrupa alertas por kit
    const kitsAgrupados = {};

    evento.alertas.forEach((alerta) => {
      // Extrai o nome do kit (primeira parte antes do " - ")
      const partesNome = alerta.nome.split(" - ");
      const nomeKit = partesNome[0]; // Ex: "Kit Night Run"
      const tamanho = partesNome[partesNome.length - 1]; // Ex: "P", "M", "G"

      if (!kitsAgrupados[nomeKit]) {
        kitsAgrupados[nomeKit] = [];
      }

      kitsAgrupados[nomeKit].push({
        tamanho: tamanho,
        estoque: alerta.estoque,
      });
    });

    // Exibe cada kit agrupado
    Object.keys(kitsAgrupados).forEach((nomeKit) => {
      relatorio += `    ${nomeKit}\n`;

      kitsAgrupados[nomeKit].forEach((item) => {
        relatorio += `    camiseta ${item.tamanho}: ${item.estoque}\n`;
      });

      relatorio += `\n`;
    });

    relatorio += `\n`;
  });

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
    const destinatarios = [
      // "alexandre.braga@nortemkt.com",
      // "otavio.michelato@nortemkt.com",
      // "cesar.vital@nortemkt.com",
      'julia.correa@nortemkt.com'
    ];
      await enviarEmail(
        destinatarios,
        assunto,
        relatorio,
        "alerta_estoque.xlsx",
        ALERTAS
      );

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

async function saveMessages() {
  try {
    const messagesData = {
      timestamp: new Date().toISOString(),
      total_eventos: MESSAGE.length,
      eventos_com_alertas: MESSAGE.filter((m) => m.tem_alertas).length,
      eventos: MESSAGE,
    };

    await fs.writeFile(
      "messages.json",
      JSON.stringify(messagesData, null, 2),
      "utf-8"
    );
    console.log("📄 Mensagens salvas em messages.json");
  } catch (error) {
    console.error("❌ Erro ao salvar mensagens:", error.message);
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

async function Monitoramento() {
  try {
    console.log("🚀 Iniciando monitoramento de estoque...");

    await getURL();
    const list = await readURL(INPUT_FILE);
    const { results, errors } = await concurrency(list, LIMITE);
    // Envia email apenas se houver alertas
    await enviarEmailAlerta();
    await salvarExcelAlertas("alertas_estoque.json", ALERTAS);
    // Limpa arquivo temporário
    await deleteJSON(INPUT_FILE);
    // Resumo final
    console.log("\n" + "=".repeat(60));
    console.log("📊 RESUMO DA EXECUÇÃO");
    console.log("=".repeat(60));
    console.log(`✅ Produtos processados: ${results.length}`);
    console.log(`❌ Erros encontrados: ${errors.length}`);
    console.log(`🚨 Eventos com alertas: ${ALERTAS.length}`);
    console.log(`📧 Email enviado: ${ALERTAS.length > 0 ? "SIM" : "NÃO"}`);
    console.log("=".repeat(60));
    return;
  } catch (error) {
    console.error("❌ Erro na execução principal:", error.message);
    return error;
  }
}

// De 3 em 3 minutos, horário comercial, segunda a sexta
cron.schedule('0 8-20/2 * * 1-5',async ()=>{
  try{
    await Monitoramento()
  }catch(error){
    throw new Error("Tafefa cancelada:"+error.message);
  }
})