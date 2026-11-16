"use client";

import { useMemo, useState } from "react";
import type { Architecture } from "@/lib/types";
import { Badge, Card, SectionLabel, Tabs, cx } from "./ui";
import { CopyButton } from "./feedback";

/* Diagrama de camadas em SVG: colunas = camadas, setas = dependências. */
export function ArchitectureDiagram({ arch }: { arch: Architecture }) {
  const [hover, setHover] = useState<string | null>(null);
  const BOX_W = 168, BOX_H = 54, GAP_X = 58, GAP_Y = 16, PAD = 16, HEAD = 30;
  const maxRows = Math.max(1, ...arch.layers.map((l) => l.components.length));
  const width = PAD * 2 + arch.layers.length * BOX_W + (arch.layers.length - 1) * GAP_X;
  const height = PAD * 2 + HEAD + maxRows * BOX_H + (maxRows - 1) * GAP_Y;

  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    arch.layers.forEach((l, li) => {
      const colH = l.components.length * BOX_H + (l.components.length - 1) * GAP_Y;
      const top = PAD + HEAD + (maxRows * BOX_H + (maxRows - 1) * GAP_Y - colH) / 2;
      l.components.forEach((c, ci) => m.set(c.id, { x: PAD + li * (BOX_W + GAP_X), y: top + ci * (BOX_H + GAP_Y) }));
    });
    return m;
  }, [arch, maxRows]);

  const related = (id: string) => hover === null || hover === id || arch.dependencies.some((d) => (d.from === hover && d.to === id) || (d.to === hover && d.from === id));

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-bg">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Diagrama: ${arch.summary}`} className="block">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--color-faint)" />
          </marker>
          <marker id="arrow-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--color-accent)" />
          </marker>
        </defs>
        {arch.layers.map((l, li) => (
          <text key={l.id} x={PAD + li * (BOX_W + GAP_X) + BOX_W / 2} y={PAD + 12} textAnchor="middle" fill="var(--color-faint)" fontSize="10.5" letterSpacing="0.08em" style={{ textTransform: "uppercase" }}>{l.name}</text>
        ))}
        {arch.dependencies.map((d, i) => {
          const a = pos.get(d.from), b = pos.get(d.to);
          if (!a || !b) return null;
          const hi = hover !== null && (d.from === hover || d.to === hover);
          let x1, y1, x2, y2;
          if (Math.abs(a.x - b.x) < 1) { x1 = a.x + BOX_W / 2; y1 = a.y + BOX_H; x2 = b.x + BOX_W / 2; y2 = b.y; if (b.y < a.y) { y1 = a.y; y2 = b.y + BOX_H; } }
          else { const fwd = b.x > a.x; x1 = fwd ? a.x + BOX_W : a.x; y1 = a.y + BOX_H / 2; x2 = fwd ? b.x : b.x + BOX_W; y2 = b.y + BOX_H / 2; }
          const sameCol = Math.abs(a.x - b.x) < 1;
          const path = sameCol ? `M${x1} ${y1} C ${x1 + 24} ${(y1 + y2) / 2}, ${x2 + 24} ${(y1 + y2) / 2}, ${x2} ${y2}` : `M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
          return (
            <g key={i} opacity={hover === null || hi ? 1 : 0.15}>
              <path d={path} fill="none" stroke={hi ? "var(--color-accent)" : "var(--color-line-strong)"} strokeWidth={hi ? 1.5 : 1} markerEnd={`url(#${hi ? "arrow-hi" : "arrow"})`} />
              {d.label && hi && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5} textAnchor="middle" fill="var(--color-accent)" fontSize="10">{d.label}</text>}
            </g>
          );
        })}
        {arch.layers.flatMap((l) => l.components.map((c) => {
          const p = pos.get(c.id)!;
          const on = related(c.id);
          return (
            <g key={c.id} transform={`translate(${p.x} ${p.y})`} opacity={on ? 1 : 0.3} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(c.id)} onBlur={() => setHover(null)} tabIndex={0} style={{ cursor: "default", outline: "none" }}>
              <title>{`${c.name} — ${c.tech}\n${c.description}`}</title>
              <rect width={BOX_W} height={BOX_H} rx="9" fill="var(--color-surface)" stroke={hover === c.id ? "var(--color-accent)" : "var(--color-line-strong)"} />
              <text x="12" y="22" fill="var(--color-fg)" fontSize="12.5" fontWeight="500">{c.name.length > 22 ? c.name.slice(0, 21) + "…" : c.name}</text>
              <text x="12" y="39" fill="var(--color-muted)" fontSize="10.5">{c.tech.length > 27 ? c.tech.slice(0, 26) + "…" : c.tech}</text>
            </g>
          );
        }))}
      </svg>
    </div>
  );
}

export function architectureToMarkdown(a: Architecture): string {
  const lines = [
    `# Arquitetura — ${a.kindLabel}`,
    a.summary,
    "## Componentes por camada",
    ...a.layers.map((l) => `### ${l.name}\n${l.components.map((c) => `- **${c.name}** (${c.tech}): ${c.description}`).join("\n")}`),
    "## Dependências",
    a.dependencies.map((d) => `- ${d.from} → ${d.to}${d.label ? ` (${d.label})` : ""}`).join("\n"),
    a.frontend.length ? `## Frontend\n${a.frontend.map((x) => `- ${x}`).join("\n")}` : "",
    a.backend.length ? `## Backend\n${a.backend.map((x) => `- ${x}`).join("\n")}` : "",
    a.database.entities.length ? `## Base de dados (${a.database.engine})\n${a.database.entities.map((e) => `- **${e.name}**: ${e.fields.join(", ")}`).join("\n")}` : "",
    a.apis.length ? `## APIs\n${a.apis.map((x) => `- \`${x.method} ${x.path}\` — ${x.description}`).join("\n")}` : "",
    `## Autenticação\n${a.auth.map((x) => `- ${x}`).join("\n")}`,
    `## Segurança\n${a.security.map((x) => `- ${x}`).join("\n")}`,
    a.integrations.length ? `## Integrações\n${a.integrations.map((x) => `- ${x}`).join("\n")}` : "",
    a.agents.length ? `## Agentes de IA\n${a.agents.map((x) => `- **${x.name}**: ${x.responsibility}`).join("\n")}` : "",
    `## Fluxos de trabalho\n${a.workflows.map((x) => `- ${x}`).join("\n")}`,
    "## Estrutura de pastas\n```\n" + a.folderStructure + "\n```",
    `## Fases de desenvolvimento\n${a.phases.map((p) => `### ${p.name}\n${p.goals.map((g) => `- ${g}`).join("\n")}\n- Entregáveis: ${p.deliverables.join(", ")}`).join("\n")}`,
  ];
  return lines.filter(Boolean).join("\n\n");
}

type Tab = "diagram" | "stack" | "data" | "security" | "plan";

export function ArchitectureView({ arch }: { arch: Architecture }) {
  const [tab, setTab] = useState<Tab>("diagram");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="accent">{arch.kindLabel}</Badge>
          <span className="text-sm text-muted">{arch.summary}</span>
        </div>
        <CopyButton text={architectureToMarkdown(arch)} label="Copiar como Markdown" />
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} items={[{ value: "diagram", label: "Diagrama" }, { value: "stack", label: "Frontend e backend" }, { value: "data", label: "Dados e APIs" }, { value: "security", label: "Segurança e integrações" }, { value: "plan", label: "Pastas e fases" }]} />

      {tab === "diagram" && (
        <div className="space-y-3">
          <ArchitectureDiagram arch={arch} />
          <p className="text-xs text-faint">Passa o rato (ou foca com Tab) num componente para ver as suas dependências.</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {arch.layers.map((l) => (
              <Card key={l.id} title={l.name}>
                <ul className="space-y-2.5">
                  {l.components.map((c) => (
                    <li key={c.id}>
                      <div className="text-[13px]"><span className="font-medium">{c.name}</span> <span className="text-muted">· {c.tech}</span></div>
                      <div className="text-xs text-muted">{c.description}</div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          {arch.workflows.length > 0 && <Card title="Fluxos de trabalho"><ul className="space-y-1.5">{arch.workflows.map((w, i) => <li key={i} className="text-[13px] text-fg/90">{w}</li>)}</ul></Card>}
        </div>
      )}

      {tab === "stack" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="Frontend">{arch.frontend.length ? <ul className="space-y-1.5">{arch.frontend.map((x) => <li key={x} className="text-[13px]">· {x}</li>)}</ul> : <p className="text-xs text-faint">Não aplicável.</p>}</Card>
          <Card title="Backend">{arch.backend.length ? <ul className="space-y-1.5">{arch.backend.map((x) => <li key={x} className="text-[13px]">· {x}</li>)}</ul> : <p className="text-xs text-faint">Não aplicável.</p>}</Card>
          <Card title="Autenticação" className="md:col-span-2"><ul className="space-y-1.5">{arch.auth.map((x) => <li key={x} className="text-[13px]">· {x}</li>)}</ul></Card>
          {arch.agents.length > 0 && (
            <Card title="Agentes de IA" className="md:col-span-2">
              <ul className="space-y-2">{arch.agents.map((a) => <li key={a.name} className="text-[13px]"><span className="font-medium">{a.name}</span> <span className="text-muted">— {a.responsibility}</span></li>)}</ul>
            </Card>
          )}
        </div>
      )}

      {tab === "data" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Base de dados" subtitle={arch.database.engine}>
            {arch.database.entities.length ? (
              <div className="space-y-2.5">
                {arch.database.entities.map((e) => (
                  <div key={e.name} className="rounded-lg border border-line bg-bg px-3 py-2">
                    <div className="text-[13px] font-medium">{e.name}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted">{e.fields.join(" · ")}</div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-faint">Não aplicável.</p>}
          </Card>
          <Card title="APIs">
            {arch.apis.length ? (
              <ul className="space-y-1.5">
                {arch.apis.map((x, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px]">
                    <span className={cx("w-14 shrink-0 font-mono text-[11px]", x.method === "GET" ? "text-info" : x.method === "DELETE" ? "text-bad" : "text-accent")}>{x.method}</span>
                    <span className="min-w-0"><span className="font-mono text-fg/90">{x.path}</span> <span className="text-muted">— {x.description}</span></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-faint">Sem API própria nesta arquitetura.</p>}
          </Card>
        </div>
      )}

      {tab === "security" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card title="Segurança"><ul className="space-y-1.5">{arch.security.map((x) => <li key={x} className="text-[13px]">· {x}</li>)}</ul></Card>
          <Card title="Integrações">{arch.integrations.length ? <ul className="space-y-1.5">{arch.integrations.map((x) => <li key={x} className="text-[13px]">· {x}</li>)}</ul> : <p className="text-xs text-faint">Nenhuma integração externa identificada.</p>}</Card>
        </div>
      )}

      {tab === "plan" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <Card title="Estrutura de pastas"><pre className="prose-prompt overflow-x-auto text-muted">{arch.folderStructure}</pre></Card>
          <Card title="Fases de desenvolvimento">
            <ol className="space-y-4">
              {arch.phases.map((p, i) => (
                <li key={p.name} className="relative pl-6">
                  <span className="absolute left-0 top-0.5 grid size-4 place-items-center rounded-full border border-accent/40 text-[9px] text-accent">{i}</span>
                  <div className="text-[13px] font-medium">{p.name}</div>
                  {p.goals.map((g) => <div key={g} className="text-xs text-muted">{g}</div>)}
                  <div className="mt-1 flex flex-wrap gap-1">{p.deliverables.map((d) => <Badge key={d}>{d}</Badge>)}</div>
                </li>
              ))}
            </ol>
          </Card>
          <div className="lg:col-span-2"><SectionLabel>Dependências</SectionLabel>
            <div className="flex flex-wrap gap-1.5">{arch.dependencies.map((d, i) => <Badge key={i}>{d.from} → {d.to}{d.label ? ` · ${d.label}` : ""}</Badge>)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
