"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ensureProfileAndFamily, joinFamily } from "../lib/auth";

export default function Page() {
  const [session, setSession] = useState<any>(null);
  const [mode, setMode] = useState<"login"|"signup">("login");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [familyCode, setFamilyCode] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) window.location.href = "/app";
  }, [session]);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
        if (error) throw error;
        await ensureProfileAndFamily();
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password: pass });
        if (error) throw error;
        // if email confirmation is ON, user must confirm before session exists
        await ensureProfileAndFamily(name.trim() || undefined);
      }
    } catch (e:any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true); setErr(null);
    try {
      await joinFamily(familyCode.trim());
      window.location.href = "/app";
    } catch (e:any) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{paddingTop: 36}}>
      <div className="grid cols2">
        <div className="card">
          <h1>CasalGastos</h1>
          <p><small>Sistema por link (PC + celular) com modo app (PWA). Login + gastos compartilhados do casal.</small></p>
          <div className="row" style={{marginTop: 10}}>
            <button className={"btn " + (mode==="login" ? "primary":"")} onClick={() => setMode("login")}>Entrar</button>
            <button className={"btn " + (mode==="signup" ? "primary":"")} onClick={() => setMode("signup")}>Criar conta</button>
          </div>

          <label>E-mail</label>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seuemail@gmail.com" />
          <label>Senha</label>
          <input className="input" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" />
          {mode==="signup" ? (
            <>
              <label>Seu nome (opcional)</label>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Andressa" />
            </>
          ) : null}

          {err ? <p style={{color:"#f87171"}}>{err}</p> : null}

          <div className="row" style={{marginTop: 14}}>
            <button disabled={busy} className="btn primary" onClick={submit}>{busy ? "Aguarde..." : (mode==="login" ? "Entrar" : "Criar conta")}</button>
          </div>

          <hr style={{border:"none", borderTop:"1px solid var(--line)", margin:"16px 0"}} />

          <h2 style={{fontSize:16}}>Sua esposa vai entrar na mesma “casa”</h2>
          <p><small>No perfil (depois de logar), copie o <b>Family Code</b>. No outro login, cole aqui:</small></p>
          <label>Family Code (UUID)</label>
          <input className="input" value={familyCode} onChange={e=>setFamilyCode(e.target.value)} placeholder="ex: 6e9f...-...." />
          <button disabled={busy || familyCode.trim().length < 8} className="btn" onClick={join}>Entrar em família</button>
        </div>

        <div className="card">
          <h2>Instalar como “app” no iPhone</h2>
          <ol>
            <li>Abra este link no Safari</li>
            <li>Toque em <b>Compartilhar</b></li>
            <li>Selecione <b>Adicionar à Tela de Início</b></li>
          </ol>
          <p><small>Depois disso, ele abre em tela cheia como aplicativo.</small></p>

          <div className="grid cols3" style={{marginTop: 12}}>
            <div className="card">
              <div className="badge">✔</div>
              <p><b>PC + Celular</b><br/><small>Mesmos dados</small></p>
            </div>
            <div className="card">
              <div className="badge">🔒</div>
              <p><b>Privado</b><br/><small>RLS por família</small></p>
            </div>
            <div className="card">
              <div className="badge">⚡</div>
              <p><b>Rápido</b><br/><small>Next.js</small></p>
            </div>
          </div>
        </div>
      </div>

      <p style={{marginTop: 14}}><small>Obs.: você precisa configurar o Supabase (URL/Anon key) no `.env.local`.</small></p>
    </div>
  );
}
