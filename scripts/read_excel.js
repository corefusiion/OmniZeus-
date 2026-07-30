const xlsx = require('xlsx');
const workbook = xlsx.readFile('./modelo/Planilha_Modelo_clientes.xls');
console.log("Sheet names:", workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  console.log(data.slice(0, 10)); // print first 10 rows
});
