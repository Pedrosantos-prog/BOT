import { request, gql } from "graphql-request";
import pool from './database.js'
import QUERY_BD from "./queryBD.js";
import fs from 'fs/promises';
import enviarEmail from './send.js'


// ==== CONFIG ====
const endpoint = "https://runningland.com.br/graphql";
const INPUT_FILE = "url.json";
const LIMITE = 10

const MESSAGE = []

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
                    stock_info {
                      qty
                    }
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
  try{
    const [rows] = await pool.query(QUERY_BD.query_URL)
    await saveJSON(rows)
    return rows;
  } catch(err){
    throw new Error("Error ao consultar dados do banco de dados!");
  }
}

async function saveJSON(rows) {
  try{
    const data = await fs.writeFile('url.json',JSON.stringify(rows,null,2),'utf-8')
    console.log('Arquivo salvo!')
    return data
  } catch(err){
    throw new Error("Error ao salvar query no json!");
  }
}

async function readURL(path) {
  try{
   const data = await fs.readFile(path,'utf-8')
   const response = JSON.parse(data)
   const list = response.map(e=>e.URL) 
   return list
  } catch(e){
    throw new Error("Não foi possivel ler arquivo json");
  }
}


async function deleteJSON(path) {
  try{
    const data = await fs.unlink(path);
    console.log('Arquivo excluido')
    return data
  } catch(err){
    throw new Error("Error ao deletar json!");
  }
}

async function searchData(urlKey) {
  try {
    const data = await request(endpoint, Products, { urlKey });
    
    // Gera a mensagem formatada
    const message = formatEventMessage(data);
    console.log("\n" + "=".repeat(60));
    console.log(`EVENTO: ${urlKey}`);
    console.log("=".repeat(60));
    console.log(message);
    
    // Adiciona ao array MESSAGE com estrutura melhorada
    MESSAGE.push({
      url_key: urlKey,
      evento: data.products.items[0]?.name || 'Nome não encontrado',
      status: data.products.items[0]?.stock_status || 'Status desconhecido',
      timestamp: new Date().toISOString(),
      produtos: data.products.items[0]?.related_products || [],
      mensagem_formatada: message
    });
    
    return data;
  } catch (err) {
    console.error(`❌ Erro ao processar ${urlKey}:`, err.message);
    throw new Error(`Erro ao consultar ${urlKey}: ${err.message}`);
  }
}

function formatEventMessage(dataProduct) {
  try {
    const product = dataProduct.products.items[0];
    
    if (!product) {
      return "❌ Produto não encontrado";
    }

    // Informações básicas do evento
    const eventName = product.name;
    const eventSku = product.sku;
    const stockStatus = product.stock_status;

    let message = `🏃‍♂️ **${eventName}**\n`;
    message += `📦 SKU: ${eventSku}\n`;
    message += `📊 Status: ${stockStatus}\n`;
    message += `${"=".repeat(40)}\n\n`;

    // Processa produtos relacionados (Bundle products)
    if (product.related_products && product.related_products.length > 0) {
      message += `📋 **PRODUTOS DO EVENTO:**\n\n`;

      product.related_products.forEach((relatedProduct, index) => {
        message += `${index + 1}. **${relatedProduct.name}**\n`;
        message += `   📦 SKU: ${relatedProduct.sku}\n`;
        message += `   🆔 ID: ${relatedProduct.id}\n`;

        // Se for um Bundle Product com items
        if (relatedProduct.items && relatedProduct.items.length > 0) {
          message += `   📏 **Modalidades:**\n`;
          
          relatedProduct.items.forEach(item => {
            message += `   \n   🏷️  **${item.title}**\n`;
            
            if (item.options && item.options.length > 0) {
              let totalQuantity = 0;
              
              item.options.forEach(option => {
                const quantity = option.quantity || 0;
                if(quantity<=50){
                  message += `      • ${option.label}: ${quantity} unidades [VERMELHO]\n`;
                }
                else{
                  message += `      • ${option.label}: ${quantity} unidades\n`;
                }
                totalQuantity += quantity;
                
              });
              
              message += `      📦 Total em estoque: ${totalQuantity} unidades\n`;
            }
          });
        }

        message += `\n`;
      });
    }

    return message;

  } catch (error) {
    console.error("Erro ao formatar mensagem:", error);
    return `❌ Erro ao processar dados: ${error.message}`;
  }
}

async function saveMessages() {
  try {
    const messagesData = {
      timestamp: new Date().toISOString(),
      total_eventos: MESSAGE.length,
      eventos: MESSAGE
    };
    
    await fs.writeFile('messages.json', JSON.stringify(messagesData, null, 2), 'utf-8');
    console.log('📄 Mensagens salvas em messages.json');
  } catch (error) {
    console.error('❌ Erro ao salvar mensagens:', error.message);
  }
}
async function concurrency(list,limit) {
    let index = 0; // indice atual na lista
    const results = []
    const errors = []

    async function worker() {
      while(true){
        let currentIndex;
        if(index>=list.length) break;
        currentIndex = index++ // pega o proximo index e incrementa
        if(currentIndex >= list.length) break;
        const urlkey = list[currentIndex]

        try{
          const result = await searchData(urlkey)
          results.push({urlkey, data: result})
        } catch(err){
          errors.push({urlkey, error: err.message});
        }
      }
    }

    const workers = Array.from({length:limit},()=> worker());
    await Promise.all(workers)
    return {results, errors}
}



await getURL()
const list = await readURL(INPUT_FILE)  
const {results}= await concurrency(list,LIMITE)
await deleteJSON(INPUT_FILE)

