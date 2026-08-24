const WEEKDAY_LABELS: Record<number, string> = {
  0: "Domingo",
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
};

export type WeekdayOption = {
  label: string;
  /** yyyy-MM-dd (fuso America/Sao_Paulo) */
  date: string;
  defaultChecked: boolean;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Data de hoje em America/Sao_Paulo, como componentes de calendário (sem hora). */
function todaySaoPauloParts(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Formata usando os getters locais do Date — nunca toISOString, que converte para UTC. */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatBr(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Os proximos 7 dias corridos a partir de "hoje" em America/Sao_Paulo
 * (hoje incluso). Terça a sexta vem marcada por padrão; o resto, não.
 */
export function getWeekdayOptions(): WeekdayOption[] {
  const { year, month, day } = todaySaoPauloParts();
  // Date "de calendário" pura: construída e lida só com getters locais,
  // então o fuso do navegador nunca entra na conta.
  const today = new Date(year, month - 1, day);

  return Array.from({ length: 7 }, (_, i) => {
    const occurrence = new Date(today);
    occurrence.setDate(occurrence.getDate() + i);
    const dow = occurrence.getDay();
    return {
      label: WEEKDAY_LABELS[dow],
      date: formatLocalDate(occurrence),
      defaultChecked: dow >= 2 && dow <= 5,
    };
  });
}
