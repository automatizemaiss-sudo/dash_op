const WEEKDAY_LABELS: Record<number, string> = {
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
};

export type WeekdayOption = {
  /** 1 = segunda .. 5 = sexta */
  dow: number;
  label: string;
  /** yyyy-MM-dd, próxima ocorrência a partir de hoje (fuso America/Sao_Paulo) */
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
 * Segunda a sexta com a data da próxima ocorrência de cada dia, a partir de
 * "hoje" em America/Sao_Paulo. Se hoje é terça, a terça da lista é hoje.
 */
export function getWeekdayOptions(): WeekdayOption[] {
  const { year, month, day } = todaySaoPauloParts();
  // Date "de calendário" pura: construída e lida só com getters locais,
  // então o fuso do navegador nunca entra na conta.
  const today = new Date(year, month - 1, day);
  const todayDow = today.getDay();

  return [1, 2, 3, 4, 5].map((dow) => {
    const shift = (dow - todayDow + 7) % 7;
    const occurrence = new Date(today);
    occurrence.setDate(occurrence.getDate() + shift);
    return {
      dow,
      label: WEEKDAY_LABELS[dow],
      date: formatLocalDate(occurrence),
      defaultChecked: dow !== 1,
    };
  });
}
