"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export function Nav({ title }: { title: string }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <div className="nav">
      <div className="container row" style={{paddingTop: 14, paddingBottom: 14}}>
        <strong>{title}</strong>
        <div className="spacer" />
        {email ? <span className="badge">{email}</span> : null}
        <button className="btn" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>
    </div>
  );
}
