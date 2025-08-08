import { request, gql } from "graphql-request";
import enviarEmail from "./send.js";

const endpoint = "https://runningland.com.br/graphql";

const CONSULTAS_QUERY = {
  query: gql`
    query UrlResolver($url: String!) {
      urlResolver(url: $url) {
        canonical_url
        id
        redirectCode
        relative_url
        type
        entity_uid
      }
    }
  `,
  productQuery: gql`
    query ($urlKey: String!) {
      products(filter: { url_key: { eq: $urlKey } }) {
        items {
          name
          sku
          url_key
          stock_status
        }
      }
    }
  `,
  products: gql`
    query ($page: Int!) {
      products(pageSize: 50, currentPage: $page) {
        items {
          url_key
        }
        total_count
      }
    }
  `
};

const MESSAGE = {
  DISPONIVEL: ``,
  INDISPONIVEL: ``,
};

async function response(urlParams) {
  try {
    const urlData = await request(endpoint, CONSULTAS_QUERY.query, {
      url: urlParams,
    });
    const url = urlData?.urlResolver; // entra dentro do urlResolver
    const urlKey = url.relative_url.replace("/", ""); // tira a barra da url

    const productData = await request(endpoint, CONSULTAS_QUERY.productQuery, {
      urlKey,
    });
    const produto = productData.products.items[0];
      if (produto.stock_status == "IN_STOCK") { 
      console.log(produto)
      console.log("AVISO ENVIADO!-ESTOQUE DISPONIVEL");
      return;
    }
    console.log("AVISO ENVIADO!-ESTOQUE INDISPONIVEL");
    return;
  } catch (err) {
    return err;
  }
}

response("night-run-curitiba-2025")
