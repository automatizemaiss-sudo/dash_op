import * as XLSX from "xlsx";

export type ParsedSheet = {
  columns: string[];
  rows: Record<string, string>[];
};

function isRowEmpty(row: Record<string, string>): boolean {
  return Object.values(row).every((v) => v.trim() === "");
}

/**
 * Le .csv/.xlsx/.xls no navegador. Sem limpeza de dado (telefone, dedup, etc):
 * isso e responsabilidade do n8n. So descarta linhas totalmente vazias.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");

  // CSV e texto puro sem info de encoding embutida — sem isso o SheetJS assume
  // Latin-1 e corrompe acentos (vira "NÃºmero"). Blob.text() decodifica como
  // UTF-8 por padrao, que e o caso comum (Google Sheets, Excel moderno).
  // .xlsx/.xls guardam a codificacao no proprio binario, entao vao direto.
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const headerRow = (XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })[0] ?? []) as unknown[];
  const columns = headerRow.map((h) => String(h ?? "").trim()).filter((h) => h !== "");

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const rows = rawRows
    .map((row) => {
      const normalized: Record<string, string> = {};
      for (const col of columns) {
        const value = row[col];
        normalized[col] = value === undefined || value === null ? "" : String(value);
      }
      return normalized;
    })
    .filter((row) => !isRowEmpty(row));

  return { columns, rows };
}
