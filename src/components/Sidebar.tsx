"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookMarked, Boxes, ClipboardCheck, Gauge, Lightbulb, LogOut, Menu, PenTool, Plus, Settings, X } from "lucide-react";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/new", label: "New Project", icon: Plus },
  { href: "/analyzer", label: "Idea Analyzer", icon: Lightbulb },
  { href: "/architect", label: "Prompt Architect", icon: PenTool },
  { href: "/system", label: "System Architect", icon: Boxes },
  { href: "/evaluator", label: "Prompt Evaluator", icon: ClipboardCheck },
  { href: "/library", label: "My Prompt Library", icon: BookMarked },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-[11px] font-semibold tracking-tight text-accent">AB</div>
      <div className="leading-tight">
        <div className="text-[13px] font-semibold tracking-tight">AB Prompt Studio</div>
        <div className="text-[10.5px] text-faint">Ideias → projetos → prompts</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [authOn, setAuthOn] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" }).then((r) => r.json()).then((j) => setAuthOn(!!j.enabled)).catch(() => {});
  }, []);
  if (path === "/login") return null;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  };

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Navegação principal">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
              active ? "bg-raised text-fg" : "text-muted hover:bg-raised/60 hover:text-fg",
            )}
          >
            <Icon className={cx("size-4", active ? "text-accent" : "text-faint group-hover:text-muted")} strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
      {authOn && (
        <button onClick={logout} className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-muted transition-colors hover:bg-raised/60 hover:text-fg">
          <LogOut className="size-4 text-faint" strokeWidth={1.75} />
          Terminar sessão
        </button>
      )}
    </nav>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-bg px-3 py-5 lg:flex">
        <div className="px-2 pb-6"><Logo /></div>
        {nav}
        <div className="mt-auto px-3 text-[10.5px] leading-relaxed text-faint">
          Dados guardados localmente neste browser (IndexedDB). Faz cópias de segurança em Settings.
        </div>
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-raised hover:text-fg" aria-label="Abrir menu"><Menu className="size-5" /></button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 animate-fade-in border-r border-line bg-bg px-3 py-5">
            <div className="flex items-center justify-between px-2 pb-6">
              <Logo />
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-raised" aria-label="Fechar menu"><X className="size-4" /></button>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
