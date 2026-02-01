"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Category = { id: string; name: string; icon: string };
type Tx = {
  id: string;
  amount: number;
  date: string;
  category_id: string;
  payment_method: string;
  description: string;
};

function moneyBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthRange(d: Date) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  return { s: start.toISOString().slice(0, 10), e: end.toISOString().slice(0, 10) };
}

export default function AppPage() {
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState<Category[]>([]);
  const [tx, setTx] = useState<Tx[]>([]);
  const [familyId, setFamilyId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const [month, setMonth] = useState(() => new Date());
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [payment, setPayment] = useState("pix");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      setErr(null);
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        window.location.href = "/";
        return;
      }

      // pega family_id do perfil
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user!;
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("family_id")
        .eq("id", user.id)
        .single();

      if (pErr) {
        setErr(pErr.message);
        setLoading(false);
        return;
      }

      setFamilyId(prof.family_id);
      await loadAll(prof.family_id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function loadAll(fam: string) {
    const { data: c, error: cErr } = await supabase
      .from("categories")
      .select("id,name,icon")
      .eq("family_id", fam)
      .order("name");
    if (cErr) throw cErr;
    setCats((c ?? []) as Category[]);
    if (!categoryId && (c ?? []).length) setCategoryId((c ?? [])[0].id);

    const { s, e } = monthRange(month);
    const { data: t, error: tErr } = await supabase
      .from("transactions")
      .select("id,amount,date,category_id,payment_method,description")
      .eq("family_id", fam)
      .gte("date", s)
      .lt("date", e)
      .order("date", { ascending: false });
    if (tErr) throw tErr;
    setTx((t ?? []) as Tx[]);
  }

  const total = useMemo(() => tx.reduce((sum, t) => sum + Number(t.amount), 0), [tx]);

  async function addTx() {
    try {
      setErr(null);
      const raw = amount.replaceAll(".", "").replaceAll(",", ".").trim();
      const v = Number(raw);
      if (!v || v <= 0) throw new Error("Informe um valor válido");

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user!;
      const { error } = await supabase.from("transactions").insert({
        family_id: familyId,
        created_by: user.id,
        amount: v,
        date,
        category_id: categoryId,
        payment_method: payment,
        description: desc.trim(),
      });
      if (error) throw error;

      setAmount("");
      setDesc("");
      await loadAll(familyId);
    } catch (e: any) {
      setErr(e.message ?? String(e));
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) return <div style={{ padding: 16 }}>Carregando…</div>;

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>CasalGastos</h2>
        <div style={{ flex: 1 }} />
        <button onClick={signOut}>Sair</button>
      </div>

      {err ? <p style={{ color: "crimson" }}>{err}</p> : null}

      <p>
        <b>Total do mês:</b> {moneyBRL(total)} <br />
        <small>Family Code: {familyId}</small>
      </p>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr", marginTop: 12 }}>
        <div style={{ border: "1px solid rgba(0,0,0,.1)", padding: 12, borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Adicionar gasto</h3>

          <label>Valor</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 12,50" />

          <label>Categoria</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>

          <label>Pagamento</label>
          <select value={payment} onChange={(e) => setPayment(e.target.value)}>
            <option value="pix">Pix</option>
            <option value="cartao">Cartão</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="boleto">Boleto</option>
          </select>

          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <label>Descrição</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Farmácia" />

          <div style={{ marginTop: 10 }}>
            <button onClick={addTx}>Salvar</button>
          </div>
        </div>

        <div style={{ border: "1px solid rgba(0,0,0,.1)", padding: 12, borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Lançamentos</h3>
          {tx.length === 0 ? (
            <p>Sem lançamentos neste mês.</p>
          ) : (
            <ul>
              {tx.map((t) => (
                <li key={t.id}>
                  {t.date} — <b>{moneyBRL(Number(t.amount))}</b> —{" "}
                  {cats.find((c) => c.id === t.category_id)?.name ?? "Categoria"} — {t.payment_method} —{" "}
                  {t.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>◀ Mês</button>{" "}
        <button onClick={() => setMonth(new Date())}>Hoje</button>{" "}
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Mês ▶</button>
      </div>
    </div>
  );
}
