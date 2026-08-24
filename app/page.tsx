"use client";

import { useMemo, useState, type ChangeEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBr, getWeekdayOptions } from "@/lib/dates";
import { extractQualWebn, findPhoneColumn } from "@/lib/leads";
import { parseSpreadsheetFile } from "@/lib/parse-sheet";

type DistribuirResult = {
  ok: boolean;
  lote: string;
  qual_webn: string;
  recebidos: number;
  distribuidos: number;
  duplicados: number;
  sem_telefone: number;
  por_dia: Record<string, number>;
};

function extractErrorMessage(data: unknown, rawText: string, status: number): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  if (typeof data === "string" && data.trim() !== "") return data;
  if (rawText.trim() !== "") return rawText;
  return `Erro ${status} ao chamar o servidor.`;
}

export default function Home() {
  const [weekdayOptions] = useState(() => getWeekdayOptions());
  const [selectedDows, setSelectedDows] = useState<number[]>(() =>
    getWeekdayOptions()
      .filter((w) => w.defaultChecked)
      .map((w) => w.dow)
  );

  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);

  const [lote, setLote] = useState("");
  const [qualWebnOverride, setQualWebnOverride] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<DistribuirResult | null>(null);

  const autoQualWebn = extractQualWebn(lote);
  const qualWebn = qualWebnOverride ?? autoQualWebn;

  const phoneColumn = useMemo(() => findPhoneColumn(columns), [columns]);
  const semTelefoneCount = useMemo(() => {
    if (!phoneColumn) return null;
    return rows.filter((r) => r[phoneColumn].trim() === "").length;
  }, [rows, phoneColumn]);

  const hasPreview = rows.length > 0 && !isParsing && !parseError;
  const qualWebnAutoFailed = lote.trim() !== "" && autoQualWebn === "" && qualWebn.trim() === "";
  const canSubmit =
    hasPreview && lote.trim() !== "" && selectedDows.length > 0 && !isSubmitting;

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setSubmitError(null);
    setSubmitResult(null);
    setIsParsing(true);
    setColumns([]);
    setRows([]);

    try {
      const parsed = await parseSpreadsheetFile(file);
      if (parsed.rows.length === 0) {
        setParseError("O arquivo foi lido, mas não tem nenhuma linha de dados.");
      } else {
        setColumns(parsed.columns);
        setRows(parsed.rows);
      }
    } catch {
      setParseError("Não foi possível ler o arquivo. Verifique se é um .csv, .xlsx ou .xls válido.");
    } finally {
      setIsParsing(false);
    }
  }

  function toggleDow(dow: number, checked: boolean) {
    setSelectedDows((prev) => (checked ? [...prev, dow] : prev.filter((d) => d !== dow)));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitResult(null);

    const dias = weekdayOptions
      .filter((w) => selectedDows.includes(w.dow))
      .map((w) => w.date);

    try {
      const res = await fetch("/api/distribuir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lote: lote.trim(),
          qual_webn: qualWebn.trim(),
          dias,
          leads: rows,
        }),
      });

      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // resposta não era JSON — extractErrorMessage cai para o texto cru
      }

      if (!res.ok) {
        setSubmitError(extractErrorMessage(data, text, res.status));
      } else {
        setSubmitResult(data as DistribuirResult);
      }
    } catch {
      setSubmitError("Falha de rede ao tentar enviar. Verifique sua conexão e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <header className="mb-8">
        <p className="mb-1 font-heading text-xs font-semibold uppercase tracking-[0.15em] text-accent-foreground/70">
          Operação WhatsApp
        </p>
        <h1 className="font-heading text-3xl font-bold text-foreground">
          Distribuição de Leads
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Suba a planilha semanal, confira o que foi lido e dispare para a fila do n8n.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Arquivo de leads</CardTitle>
            <CardDescription>Aceita .csv, .xlsx ou .xls</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
            {isParsing && <p className="text-sm text-muted-foreground">Lendo {fileName}...</p>}
            {parseError && (
              <Alert variant="destructive">
                <AlertTitle>Erro ao ler o arquivo</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Dados do lote</CardTitle>
            <CardDescription>Identifica o lote no n8n e na planilha do Google</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lote">Nome do lote</Label>
              <Input
                id="lote"
                placeholder="S83 - Viu Pitch - W1"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="qual-webn">qual_webn</Label>
              <Input
                id="qual-webn"
                placeholder="1"
                value={qualWebn}
                onChange={(e) => setQualWebnOverride(e.target.value)}
                disabled={isSubmitting}
              />
              {qualWebnAutoFailed && (
                <p className="text-xs text-muted-foreground">
                  Não foi possível extrair o número do W a partir do nome do lote — preencha manualmente.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <Label>Dias de disparo</Label>
              <div className="flex flex-col gap-2">
                {weekdayOptions.map((option) => {
                  const checked = selectedDows.includes(option.dow);
                  return (
                    <label
                      key={option.dow}
                      className="flex items-center gap-3 text-sm text-foreground"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleDow(option.dow, value === true)}
                        disabled={isSubmitting}
                      />
                      <span>
                        {option.label} <span className="text-muted-foreground">({formatBr(option.date)})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {selectedDows.length === 0 && (
                <p className="text-xs text-destructive">Selecione ao menos um dia.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {hasPreview && (
          <Card>
            <CardHeader>
              <CardTitle>3. Preview</CardTitle>
              <CardDescription>Confira antes de disparar — esta é a única chance de pegar um arquivo errado</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total de linhas: </span>
                  <span className="font-medium">{rows.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sem telefone: </span>
                  <span className="font-medium">
                    {semTelefoneCount === null ? "—" : semTelefoneCount}
                  </span>
                </div>
              </div>

              {!phoneColumn && (
                <Alert>
                  <AlertTitle>Coluna de telefone não identificada</AlertTitle>
                  <AlertDescription>
                    Não encontramos uma coluna de telefone entre as colunas do arquivo. O n8n tem sua
                    própria detecção e pode reconhecer mesmo assim — isso só afeta a contagem aqui no preview.
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <p className="mb-2 text-sm text-muted-foreground">Colunas detectadas</p>
                <div className="flex flex-wrap gap-1.5">
                  {columns.map((col) => (
                    <Badge key={col} variant="secondary">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm text-muted-foreground">Primeiras 5 linhas</p>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((col) => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          {columns.map((col) => (
                            <TableCell key={col}>{row[col]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <Button size="lg" disabled={!canSubmit} onClick={handleSubmit}>
            {isSubmitting ? "Distribuindo..." : "Distribuir"}
          </Button>
        </div>

        {submitError && (
          <Alert variant="destructive">
            <AlertTitle>Erro ao distribuir</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {submitResult && (
          <Card>
            <CardHeader>
              <CardTitle>4. Resultado</CardTitle>
              <CardDescription>Lote &quot;{submitResult.lote}&quot; (qual_webn {submitResult.qual_webn})</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <ResultStat label="Recebidos" value={submitResult.recebidos} />
                <ResultStat label="Distribuídos" value={submitResult.distribuidos} />
                <ResultStat label="Duplicados" value={submitResult.duplicados} />
                <ResultStat label="Sem telefone" value={submitResult.sem_telefone} />
              </div>

              <div>
                <p className="mb-2 text-sm text-muted-foreground">Por dia</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Leads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(submitResult.por_dia).map(([date, count]) => (
                      <TableRow key={date}>
                        <TableCell>{formatBr(date)}</TableCell>
                        <TableCell>{count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
