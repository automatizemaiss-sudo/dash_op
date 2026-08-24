const PHONE_COLUMN_ALIASES = new Set([
  "numerodetelefone",
  "telefone",
  "celular",
  "whatsapp",
  "phone",
  "contactphone",
]);

const COMBINING_DIACRITIC_START = 0x0300;
const COMBINING_DIACRITIC_END = 0x036f;

/** remove acento, espaco e pontuacao, compara em minusculo - mesmo criterio do n8n. */
function normalizeHeader(header: string): string {
  const decomposed = header.normalize("NFD");
  let stripped = "";
  for (const ch of decomposed) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= COMBINING_DIACRITIC_START && code <= COMBINING_DIACRITIC_END) continue;
    stripped += ch;
  }
  return stripped.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** So para o preview (contar "sem telefone"). O n8n e quem decide de verdade. */
export function findPhoneColumn(columns: string[]): string | null {
  return columns.find((col) => PHONE_COLUMN_ALIASES.has(normalizeHeader(col))) ?? null;
}

/** Extrai o número final de "... W3" / "...W 12" no nome do lote. Vazio se não casar. */
export function extractQualWebn(lote: string): string {
  const match = lote.match(/W\s*(\d+)\s*$/i);
  return match ? match[1] : "";
}
