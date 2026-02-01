"use client";
import { AppShell } from "../components/AppShell";


import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Upload, Tags } from "lucide-react";

const items = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/categorias", label: "Categorias", icon: Tags }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    return (
  <AppShell>
    {/* seu conteúdo atual do dashboard aqui dentro */}
  </AppShell>
);

    <div style={{ minHeight: "100vh", background: "#0b0f19", color: "#e6e9f2" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(10px)",
          background: "rgba(11, 15, 25, 0.7)",
          borderBottom: "1px solid rgba(255,255,255,.08)"
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: "#7c3aed" }} />
            <strong style={{ letterSpacing: 0.4 }}>CasalGastos</strong>
          </div>

          <nav style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            {items.map((it) => {
              const active = pathname === it.href;
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 12,
                    textDecoration: "none",
                    color: active ? "#0b0f19" : "#e6e9f2",
                    background: active ? "#a78bfa" : "rgba(255,255,255,.06)",
                    border: "1px solid rgba(255,255,255,.10)"
                  }}
                >
                  <Icon size={18} />
                  <span style={{ fontSize: 14 }}>{it.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px" }}>
        {children}
      </main>
    </div>
  );
}
