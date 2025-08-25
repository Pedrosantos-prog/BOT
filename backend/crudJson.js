import fs from 'fs/promises';
import QUERY_BD from "./queryBD.js";
import pool from './database.js';

async function getURL() {
  try {
    const [rows] = await pool.query(QUERY_BD.query_URL);
    await saveJSON(rows);
    await pool.end();
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

export {
  getURL,
  saveJSON,
  readURL,
  deleteJSON
};