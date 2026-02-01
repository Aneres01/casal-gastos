"use client";

import * as XLSX from "xlsx";
import { useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { AppShell } from "../components/AppShell";

type PreviewRow = Record<string, any>;

function toISODate(v: any): string | null {
  if (!v) return null;

  // Excel date number
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const dt = new Date(d.y, d.m - 1, d.d);
    return dt.toISOString().slice(0, 10);
  }

  // dd/mm/yyyy or dd/mm
  if (typeof v === "string") {
    const s = v.trim();
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m1) {
      const [_, dd, mm, yyyy] = m1;
      const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      return dt.toISOString().slice(0, 10);
    }
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m2) return null; // sem ano: vamos usar data padrão
  }

  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}

function parseMoney(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const s = v.replaceAll("R$", "").trim().replaceAll(".", "").replaceAll(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function getFamilyIdOrThrow(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Você precisa estar logado.");

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user!;
  const { data: prof, error } = await supabase
    .from("profiles")
    .select("family_id")
    .eq("id", user.id)
    .single();

  if (error) throw new Error(error.message);
  return prof.family_id as string;
}

export default function ImportarPage() {
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Mapeamento (o usuário escolhe)
  const [colDesc, setColDesc] = useState("");
  const [colValue, setColValue] = useState("");
  const [colDate, setColDate] = useState("");
  const [colCategory, setColCategory] = useState("");
  const [colPay, setColPay] = useState("");

  const [defaultDate, setDefaultDate] = useState(() => new Date().toISOString().slice(0, 10));

  const preview = useMemo(() => rows.slice(0, 15), [rows]);

  async function onFile(file: File) {
    setError("");
    setStatus("Lendo arquivo…");

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });

    setSheetNames(wb.SheetNames);
    const first = wb.SheetNames[0] ?? "";
    setSelectedSheet(first);

    const ws = wb.Sheets[first];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as PreviewRow[];

    const cols = json[0] ? Object.keys(json[0]) : [];
    setColumns(cols);
    setRows(json);

    // tentativa de auto-map
    const find = (rx: RegExp) => cols.find((c) => rx.test(c.trim().toLowerCase())) ?? "";
    setColDesc(find(/descr/i));
    setColValue(find(/valor/i));
    setColDate(find(/^data$/i));
    setColCategory(find(/categ/i));
    setColPay(find(/pag/i));

    setStatus(`Arquivo carregado. Linhas: ${json.length}`);
  }

  async function onChangeSheet(sheet: string, file: File) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[sheet];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as PreviewRow[];

    const cols = json[0] ? Object.keys(json[0]) : [];
    setColumns(cols);
    setRows(json);

    const find = (rx: RegExp) => cols.find((c) => rx.test(c.trim().toLowerCase())) ?? "";
    setColDesc(find(/descr/i));
    setColValue(find(/valor/i));
    setColDate(find(/^data$/i));
    setColCategory(find(/categ/i));
    setColPay(find(/pag/i));
  }

  async function importNow() {
    setError("");
    setStatus("Preparando importação…");

    if (!colDesc || !colValue) {
      setError("Selecione ao menos as colunas de Descrição e Valor.");
      return;
    }

    try {
      const familyId = await getFamilyIdOrThrow();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user!;

      // 1) montar itens “limpos”
      const items = rows
        .map((r) => {
          const desc = String(r[colDesc] ?? "").trim();
          const val = parseMoney(r[colValue]);
          const cat = colCategory ? String(r[colCategory] ?? "").trim() : "";
          const pay = colPay ? String(r[colPay] ?? "").trim().toLowerCase() : "";
          const dateIso = colDate ? toISODate(r[colDate]) : null;

          if (!desc || val === null) return null;

          return {
            description: desc,
            amount: val,
            category: cat || "Outros",
            payment_method: pay || "pix",
            date: dateIso ?? defaultDate
          };
        })
        .filter(Boolean) as Array<{ description: string; amount: number; category: string; payment_method: string; date: string }>;

      if (items.length === 0) {
        setError("Não encontrei linhas válidas para importar.");
        return;
      }

      setStatus(`Criando/checando categorias… (${items.length} lançamentos)`);

      // 2) garantir categorias
      const uniqueCats = Array.from(new Set(items.map((i) => i.category))).slice(0, 200);

      // pega categorias existentes
      const { data: existingCats, error: cErr } = await supabase
        .from("categories")
        .select("id,name")
        .eq("family_id", familyId);

      if (cErr) throw new Error(cErr.message);

      const existingMap = new Map<string, string>();
      (existingCats ?? []).forEach((c: any) => existingMap.set(String(c.name).toLowerCase(), c.id));

      // cria as que faltam
      const toCreate = uniqueCats
        .filter((n) => !existingMap.has(n.toLowerCase()))
        .map((name) => ({ family_id: familyId, name, icon: "💸" }));

      if (toCreate.length) {
        const { data: created, error: createErr } = await supabase.from("categories").insert(toCreate).select("id,name");
        if (createErr) throw new Error(createErr.message);
        (created ?? []).forEach((c: any) => existingMap.set(String(c.name).toLowerCase(), c.id));
      }

      setStatus("Inserindo lançamentos…");

      // 3) inserir transações em lotes
      const payload = items.map((i) => ({
        family_id: familyId,
        created_by: user.id,
        amount: i.amount,
        date: i.date,
        payment_method: i.payment_method,
        description: i.description,
        category_id: existingMap.get(i.category.toLowerCase())!
      }));

      const batchSize = 200;
      for (let i = 0; i < payload.length; i += batchSize) {
        const batch = payload.slice(i, i + batchSize);
        const { error: insErr } = await supabase.from("transactions").insert(batch);
        if (insErr) throw new Error(insErr.message);
      }

      setStatus(`✅ Importação concluída: ${payload.length} lançamentos`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStatus("");
    }
  }

  // guardo o último arquivo pra trocar de aba (sheet)
  const [lastFile, setLastFile] = useState<File | null>(null);

  return (
    <AppShell>
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,.10)",
            borderRadius: 16,
            padding: 14,
            background: "rgba(255,255,255,.04)"
          }}
        >
          <h2 style={{ margin: 0 }}>Importar planilha (Excel)</h2>
          <p style={{ opacity: 0.85, marginTop: 6 }}>
            Faça upload do seu XLSX/CSV. Se a planilha não tiver data, você pode definir uma data padrão.
          </p>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setLastFile(f);
              await onFile(f);
            }}
          />

          {sheetNames.length > 0 && lastFile ? (
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Aba (Sheet)</label>
                <select
                  value={selectedSheet}
                  onChange={async (e) => {
                    const s = e.target.value;
                    setSelectedSheet(s);
                    await onChangeSheet(s, lastFile);
                  }}
                >
                  {sheetNames.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Data padrão (se faltar)</label>
                <input type="date" value={defaultDate} onChange={(e) => setDefaultDate(e.target.value)} />
              </div>
            </div>
          ) : null}
        </div>

        {columns.length > 0 ? (
          <div
            style={{
              border: "1px solid rgba(255,255,255,.10)",
              borderRadius: 16,
              padding: 14,
              background: "rgba(255,255,255,.04)"
            }}
          >
            <h3 style={{ marginTop: 0 }}>Mapeamento de colunas</h3>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div>
                <label>Descrição *</label>
                <select value={colDesc} onChange={(e) => setColDesc(e.target.value)}>
                  <option value="">Selecione…</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Valor *</label>
                <select value={colValue} onChange={(e) => setColValue(e.target.value)}>
                  <option value="">Selecione…</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Data</label>
                <select value={colDate} onChange={(e) => setColDate(e.target.value)}>
                  <option value="">(sem)</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Categoria</label>
                <select value={colCategory} onChange={(e) => setColCategory(e.target.value)}>
                  <option value="">(sem)</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Forma de Pagto</label>
                <select value={colPay} onChange={(e) => setColPay(e.target.value)}>
                  <option value="">(sem)</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={importNow}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "#a78bfa",
                  color: "#0b0f19",
                  fontWeight: 700
                }}
              >
                Importar para o app
              </button>

              {status ? <span style={{ opacity: 0.9 }}>{status}</span> : null}
              {error ? <span style={{ color: "#fb7185" }}>{error}</span> : null}
            </div>

            <div style={{ marginTop: 14 }}>
              <h4 style={{ margin: "8px 0" }}>Pré-visualização (primeiras 15 linhas)</h4>
              <div style={{ overflow: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,.08)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead style={{ background: "rgba(255,255,255,.06)" }}>
                    <tr>
                      {columns.slice(0, 8).map((c) => (
                        <th key={c} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, idx) => (
                      <tr key={idx}>
                        {columns.slice(0, 8).map((c) => (
                          <td key={c} style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,.06)", opacity: 0.95 }}>
                            {String(r[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ opacity: 0.75, marginTop: 10 }}>
                Dica: se sua planilha “gastos detalhados” não tiver datas por linha, use a data padrão e depois você ajusta dentro do app.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
