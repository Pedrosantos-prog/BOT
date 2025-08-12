import { request, gql } from "graphql-request";
import fs from "fs";

// ==== CONFIG ====
const endpoint = "https://runningland.com.br/graphql";
const INPUT_FILE = "Untitled.json";

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
          stock_info {
            qty
          }
          related_products {
            id
            position
            items {
              title
            }
          }
        }
      }
    }
  }
`;

const getJSON = () => {
  try {
    const data = fs.readFileSync("Untitled.json", "utf-8");
    const response = JSON.parse(data);
    const arrayData = response.map((e) => {
      return e.URL;
    });
    return arrayData;
  } catch (err) {
    return err;
  }
};

const getProduct = async (urlKey) => {
  try {
    const data = await request(endpoint, Products, { urlKey });
    console.log(data.products.items[0]);
    return data;
  } catch (err) {
    return err;
  }
};

const concurrency = async (list, limit) => {
  let index = 0;

  const worker = async () => {
    while (index < list.length) {
      const currentIndex = index++;
      const urlKey = list[currentIndex];
      await getProduct(urlKey);
    }
  };

  const workers = Array.from({ length: limit }, () => worker());
  await Promise.all(workers);
};

const system = async () => {
  try {
    const listURL = await getJSON();
    await concurrency(listURL, 5);
    return;
  } catch (err) {
    return err;
  }
};

const getValidate = (getProducts) => {
  try {
    const qty = getProducts.products.items.stock_info;
    console.log(qty);
  } catch (err) {
    return err;
  }
};

system();
