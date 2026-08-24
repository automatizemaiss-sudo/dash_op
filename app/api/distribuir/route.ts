import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Medido na pratica: ~12.7s fixos + ~25ms/lead, entao ~40s pro lote cheio de
// 1100. Vercel Hobby com Fluid compute permite ate 300s de graca — 120s da
// bastante folga sem deixar o operador esperando 5min se o n8n travar.
export const maxDuration = 120;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UPSTREAM_TIMEOUT_MS = 110_000;

type ValidationError = { message: string };

function validate(body: unknown): ValidationError | null {
  if (typeof body !== "object" || body === null) {
    return { message: "Corpo da requisição inválido." };
  }
  const { lote, dias, leads } = body as Record<string, unknown>;

  if (typeof lote !== "string" || lote.trim() === "") {
    return { message: "Nome do lote é obrigatório." };
  }
  if (
    !Array.isArray(dias) ||
    dias.length === 0 ||
    !dias.every((d) => typeof d === "string" && ISO_DATE_RE.test(d))
  ) {
    return { message: "Selecione ao menos um dia válido (formato yyyy-MM-dd)." };
  }
  if (!Array.isArray(leads) || leads.length === 0) {
    return { message: "Nenhum lead para enviar." };
  }
  return null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Corpo da requisição não é um JSON válido." }, { status: 400 });
  }

  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json({ ok: false, ...validationError }, { status: 400 });
  }

  const n8nUrl = process.env.N8N_DISTRIBUI_URL;
  if (!n8nUrl) {
    console.error("distribuir: variável de ambiente N8N_DISTRIBUI_URL não configurada");
    return NextResponse.json(
      { ok: false, message: "Configuração do servidor incompleta (N8N_DISTRIBUI_URL)." },
      { status: 500 }
    );
  }

  const { lote, qual_webn, dias, leads } = body as Record<string, unknown>;
  const payload: Record<string, unknown> = { lote, qual_webn, dias, leads };

  const token = process.env.N8N_DISTRIBUI_TOKEN;
  if (token) payload.token = token;

  console.log("distribuir: encaminhando lote ao n8n", {
    lote,
    qual_webn,
    dias,
    totalLeads: Array.isArray(leads) ? leads.length : 0,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    console.error("distribuir: falha ao chamar n8n", timedOut ? "timeout" : error);
    return NextResponse.json(
      {
        ok: false,
        message: timedOut
          ? "Tempo limite excedido ao aguardar o n8n."
          : "Falha ao conectar com o n8n.",
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    console.error("distribuir: n8n retornou erro", upstream.status);
  }

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}
