import { request, gql } from "graphql-request";
import fs from "fs";

const endpoint = "https://runningland.com.br/graphql";

const Products = gql`
  query Products($urlKey: String!) {
    products(filter: { url_key: { eq: $urlKey } }) {
      total_count
      items {
        __typename
        # Informações básicas do evento
        id
        name
        sku
        url_key
        stock_status

        # Para SimpleProduct
        ... on SimpleProduct {
          stock_info {
            qty
          }
          related_products {
            id
            position
            name
            sku
            stock_info {
              qty
            }

            # Para produtos Bundle (que contêm outros produtos)
            ... on BundleProduct {
              items {
                title
                options {
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

async function search(urlKey) {
  try {
    const data = await request(endpoint, Products, { urlKey }); // Corrigido aqui
    console.log("Total de produtos encontrados:", data.products.total_count);
    console.log("Dados dos produtos:", JSON.stringify(data.products, null, 2));

    // Opcional: salvar em arquivo
    // fs.writeFileSync('produtos.json', JSON.stringify(data, null, 2));
    // console.log('Dados salvos em produtos.json');

    return data;
  } catch (err) {
    console.error("Erro na consulta GraphQL:", err);
    return err;
  }
}

// Executar a busca
search("blue-run-florianopolis-2025");
