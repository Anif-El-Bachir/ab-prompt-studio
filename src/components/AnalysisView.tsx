"use client";

import { AlertTriangle, ArrowRightLeft, Clock, Flag, Lightbulb, Users } from "lucide-react";
import type { Basis, IdeaAnalysis } from "@/lib/types";
import { Badge, Card, ScoreBar, SectionLabel, cx, scoreTone } from "./ui";

const BASIS: Record<Basis, { label: string; tone: "ok" | "info" | "neutral" }> = {
  evidence: { label: "evidência", tone: "ok" },
  assumption: { label: "pressuposto", tone: "info" },
  unknown: { label: "desconhecido", tone: "neutral" },
};

export function BasisBadge({ basis }: { basis: Basis }) {
  return <Badge tone={BASIS[basis].tone}>{BASIS[basis].label}</Badge>;
}

function List({ items, icon, empty }: { items: string[]; icon?: React.ReactNode; empty: string }) {
  if (!items.length) return <p className="text-xs text-faint">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-fg/90">
          <span className="mt-1 shrink-0 text-faint">{icon ?? "—"}</span>
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

export function AnalysisView({ analysis }: { analysis: IdeaAnalysis }) {
  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-line bg-bg px-4 py-3 text-xs leading-relaxed text-muted">{analysis.disclaimer}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {analysis.dimensions.map((d) => {
          const unknown = d.basis === "unknown";
          return (
            <div key={d.key} className="rounded-xl border border-line bg-surface p-4 animate-fade-in">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{d.label}</span>
                <div className="flex items-center gap-2">
                  <BasisBadge basis={d.basis} />
                  <span className={cx("w-8 text-right text-sm font-semibold tabular-nums", unknown ? "text-faint" : scoreTone(d.score, d.inverted) === "ok" ? "text-ok" : scoreTone(d.score, d.inverted) === "warn" ? "text-warn" : "text-bad")}>{unknown ? "—" : d.score}</span>
                </div>
              </div>
              <ScoreBar score={d.score} inverted={d.inverted} muted={unknown} />
              {d.inverted && <p className="mt-1.5 text-[10.5px] text-faint">Valor alto = mais exigente</p>}
              <ul className="mt-2.5 space-y-1">
                {d.rationale.map((r, i) => <li key={i} className="text-xs leading-relaxed text-muted">{r}</li>)}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Tempo estimado" subtitle="Intervalo indicativo para um MVP">
          <div className="flex items-center gap-3">
            <Clock className="size-5 text-accent" />
            <span className="text-2xl font-semibold tabular-nums">{analysis.estimatedTime.minWeeks}–{analysis.estimatedTime.maxWeeks}</span>
            <span className="text-sm text-muted">semanas</span>
          </div>
          <ul className="mt-3 space-y-1">{analysis.estimatedTime.assumptions.map((a, i) => <li key={i} className="text-xs text-muted">· {a}</li>)}</ul>
        </Card>
        <Card title="Recursos necessários">
          <List items={analysis.resources} icon={<Users className="size-3.5" />} empty="—" />
        </Card>
        <Card title="Oportunidades">
          <List items={analysis.opportunities} icon={<Lightbulb className="size-3.5" />} empty="Sem oportunidades identificadas." />
        </Card>
      </div>

      <Card title="Riscos" subtitle="Com mitigação proposta">
        {analysis.risks.length === 0 ? (
          <p className="text-xs text-faint">Nenhum risco específico identificado no texto. Isto não significa ausência de risco.</p>
        ) : (
          <div className="divide-y divide-line">
            {analysis.risks.map((r, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[90px_1fr_1fr]">
                <Badge tone={r.severity === "high" ? "bad" : r.severity === "medium" ? "warn" : "neutral"} className="w-fit">
                  <AlertTriangle className="size-3" /> {r.severity === "high" ? "alto" : r.severity === "medium" ? "médio" : "baixo"}
                </Badge>
                <p className="text-[13px]">{r.text}</p>
                <p className="text-[13px] text-muted">{r.mitigation}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Possíveis obstáculos"><List items={analysis.obstacles} icon={<Flag className="size-3.5" />} empty="Nenhum obstáculo identificado." /></Card>
        <Card title="Alternativas melhores ou mais baratas"><List items={analysis.alternatives} icon={<ArrowRightLeft className="size-3.5" />} empty="—" /></Card>
      </div>

      <Card title="Base da avaliação" subtitle="O que é facto, o que foi assumido e o que não se sabe">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div><SectionLabel>Evidência (dito por ti)</SectionLabel><List items={analysis.knowledge.evidence} empty="—" /></div>
          <div><SectionLabel>Pressupostos</SectionLabel><List items={analysis.knowledge.assumptions} empty="—" /></div>
          <div><SectionLabel>Desconhecido</SectionLabel><List items={analysis.knowledge.unknowns} empty="Nada essencial em falta." /></div>
        </div>
      </Card>
    </div>
  );
}
