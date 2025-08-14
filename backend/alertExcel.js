  // alert_excel.js
  import XLSX from "xlsx";
  import fs from "fs";

  async function salvarExcelAlertas(nomeArquivo, alertas) {
    if (!alertas || alertas.length === 0) {
      console.log("⚠️ Nenhum alerta para salvar no Excel");
      return;
    }

    // Converte os dados em um formato plano para o Excel
    const dadosPlanilha = [];

    alertas.forEach((evento) => {
      evento.alertas.forEach((alerta) => {
        // Se o estoque for um objeto (resumo por tamanho), transforma em string
        let estoqueFormatado = alerta.estoque;
        if (typeof estoqueFormatado === "object") {
          estoqueFormatado = Object.entries(estoqueFormatado)
            .map(([tamanho, qtd]) => `${tamanho}: ${qtd}`)
            .join(", ");
        }

        dadosPlanilha.push({
          Evento: evento.evento,
          "URL Key": evento.url_key,
          Produto: alerta.nome,
          SKU: alerta.sku,
          Estoque: estoqueFormatado,
          "Data/Hora": evento.timestamp,
        });
      });
    });

    // Cria a planilha
    const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alertas");

    // Salva o arquivo
    XLSX.writeFile(wb, nomeArquivo);
    console.log(`📄 Planilha salva: ${nomeArquivo}`);
  }

  export default salvarExcelAlertas;