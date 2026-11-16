"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button, Input } from "@/components/ui";

/** Só aceita caminhos internos (evita redirecionar para outro site). */
function safeNext(): string {
  const n = new URLSearchParams(window.location.search).get("next") ?? "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Não foi possível entrar.");
      window.location.href = safeNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[80dvh] items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-sm animate-fade-in rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-sm font-semibold text-accent">AB</div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">AB Prompt Studio</h1>
            <p className="text-xs text-muted">Acesso protegido</p>
          </div>
        </div>
        <label htmlFor="pw" className="mb-1.5 block text-xs font-medium text-muted">Palavra-passe</label>
        <Input id="pw" type="password" autoComplete="current-password" autoFocus value={password} maxLength={200} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="mt-2 text-xs text-bad" role="alert">{error}</p>}
        <Button type="submit" variant="primary" className="mt-4 w-full" loading={busy} disabled={!password} icon={<Lock className="size-4" />}>Entrar</Button>
        <p className="mt-4 text-[11px] leading-relaxed text-faint">A sessão fica ativa durante 30 dias neste aparelho.</p>
      </form>
    </div>
  );
}
