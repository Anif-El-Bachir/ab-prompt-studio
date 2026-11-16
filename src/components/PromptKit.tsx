"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Download, Save, ShieldAlert, Sparkles } from "lucide-react";
import type { CategoryId, ClarificationQuestion, InjectionWarning, PromptEvaluation, PromptSpec, TargetModel } from "@/lib/types";
import { SECTION_LABELS, SECTION_ORDER } from "@/lib/engines/architect";
import { MODEL_PROFILES, TARGETS } from "@/lib/engines/models";
import { CATEGORIES } from "@/lib/engines/categories";
import { exportPrompt } from "@/lib/download";
import { setHandoff, useAiStatus, useLive, useRepo } from "@/lib/hooks";
import { Badge, Button, Card, Field, Input, ScoreBar, ScoreRing, Select, Textarea, cx } from "./ui";
import { CopyButton, Modal, useToast } from "./feedback";

/* ---------- Aviso de injeção ---------- */
export function InjectionNotice({ warnings }: { warnings: InjectionWarning[] }) {
  if (!warnings.length) return null;
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-3" role="alert">
      <div className="flex items-center gap-2 text-[13px] font-medium text-warn"><ShieldAlert className="size-4" /> Possíveis instruções maliciosas no conteúdo</div>
      <p className="mt-1 text-xs text-muted">Este texto foi tratado como dados: nada foi executado. No prompt gerado, o conteúdo original fica delimitado e o modelo é instruído a ignorar estas ordens.</p>
      <ul className="mt-2 space-y-1">
        {warnings.map((w, i) => <li key={i} className="text-xs"><Badge tone={w.severity === "high" ? "bad" : "warn"}>{w.severity === "high" ? "alto" : w.severity === "medium" ? "médio" : "baixo"}</Badge> <span className="text-fg/90">{w.pattern}</span> <span className="font-mono text-faint">“{w.excerpt}”</span></li>)}
      </ul>
    </div>
  );
}

/* ---------- Perguntas de clarificação ---------- */
export function QuestionsForm({ questions, answers, onChange }: { questions: ClarificationQuestion[]; answers: Record<string, string>; onChange: (id: string, v: string) => void }) {
  if (!questions.length) return <p className="text-sm text-muted">Não há informação essencial em falta. Podes avançar.</p>;
  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <div key={q.id} className="rounded-xl border border-line bg-bg p-4">
          <div className="flex items-start justify-between gap-3">
            <label htmlFor={`q-${q.id}`} className="text-[13px] font-medium">{q.question}</label>
            {q.required && <Badge tone="accent">essencial</Badge>}
          </div>
          <p className="mb-2.5 mt-0.5 text-xs text-faint">{q.why}</p>
          {q.options && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {q.options.map((o) => (
                <button key={o} type="button" onClick={() => onChange(q.id, o)} className={cx("rounded-md border px-2.5 py-1 text-xs transition-colors", answers[q.id] === o ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted hover:border-line-strong hover:text-fg")}>{o}</button>
              ))}
            </div>
          )}
          <Input id={`q-${q.id}`} value={answers[q.id] ?? ""} placeholder={q.placeholder ?? "A tua resposta (opcional)"} onChange={(e) => onChange(q.id, e.target.value)} maxLength={600} />
        </div>
      ))}
    </div>
  );
}

/* ---------- Editor das 10 secções ---------- */
export function SpecEditor({ spec, onChange }: { spec: PromptSpec; onChange: (s: PromptSpec) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {SECTION_ORDER.map((k, i) => {
        const v = spec[k];
        const isList = Array.isArray(v);
        const text = isList ? (v as string[]).join("\n") : (v as string);
        return (
          <Field key={k} label={`${i + 1}. ${SECTION_LABELS[k]}${isList ? " (uma por linha)" : ""}`} htmlFor={`s-${k}`}>
            <Textarea
              id={`s-${k}`}
              rows={isList ? Math.min(8, Math.max(3, (v as string[]).length + 1)) : k === "context" ? 5 : 2}
              value={text}
              onChange={(e) => onChange({ ...spec, [k]: isList ? e.target.value.split("\n").map((x) => x.trimStart()).filter((x, idx, arr) => x || idx === arr.length - 1) : e.target.value })}
            />
          </Field>
        );
      })}
    </div>
  );
}

/* ---------- Seletor de modelo de destino ---------- */
export function TargetPicker({ value, onChange }: { value: TargetModel; onChange: (t: TargetModel) => void }) {
  const p = MODEL_PROFILES[value];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Modelo de destino">
        {TARGETS.map((t) => (
          <button key={t} role="radio" aria-checked={value === t} onClick={() => onChange(t)} className={cx("rounded-lg border px-3 py-1.5 text-[13px] transition-colors", value === t ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted hover:border-line-strong hover:text-fg")}>
            {MODEL_PROFILES[t].label}
          </button>
        ))}
      </div>
      <p className="text-xs text-faint">
        <span className="text-muted">{p.vendor} · formato {p.format.toUpperCase()} · {p.hasWorkspaceTools ? "com acesso típico a ficheiros/terminal" : "sem acesso assumido a ficheiros/terminal"}.</span>{" "}
        {p.limitations[0]}.
      </p>
    </div>
  );
}

/* ---------- Refinamento com IA (servidor) ---------- */
export function AiRefineButton({ content, onResult, task = "refine-prompt", label = "Refinar com IA" }: { content: string; onResult: (text: string) => void; task?: "refine-prompt" | "analyze-idea" | "review-architecture"; label?: string }) {
  const { providers, loading, error } = useAiStatus();
  const configured = providers.filter((p) => p.configured);
  const [provider, setProvider] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (!provider && configured[0]) setProvider(configured.length > 1 ? "auto" : configured[0].id); }, [configured, provider]);

  if (loading) return null;
  if (error || configured.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-faint" title="Configura uma chave em .env.local (ver Settings)">
        <Sparkles className="size-3.5" /> IA externa não configurada — motores locais ativos
      </span>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5">
      {configured.length > 1 && (
        <Select aria-label="Fornecedor" className="h-8 w-auto text-xs" value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="auto">Automático (tenta todas)</option>
          {configured.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
      )}
      <Button
        size="sm"
        icon={<Sparkles className="size-3.5" />}
        loading={busy}
        disabled={!content.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/ai/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, task, input: content }) });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
            onResult(j.text);
            const used = configured.find((p) => p.id === j.provider)?.label ?? j.provider;
            toast(`Resposta de ${used} (${j.model})${j.attempts?.length ? ` — ${j.attempts.length} fornecedor(es) falharam antes` : ""}.`);
          } catch (e) {
            toast(e instanceof Error ? e.message : "Falha no pedido à IA.", "bad");
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
    </div>
  );
}

/* ---------- Guardar na biblioteca ---------- */
export function SavePromptModal({ open, onClose, content, target, category, spec, projectId, defaultTitle, onSaved }: {
  open: boolean; onClose: () => void; content: string; target: TargetModel; category: CategoryId; spec?: PromptSpec; projectId?: string; defaultTitle: string; onSaved?: (id: string) => void;
}) {
  const repo = useRepo();
  const toast = useToast();
  const { data: collections } = useLive((r) => r.listCollections());
  const [title, setTitle] = useState(defaultTitle);
  const [tags, setTags] = useState("");
  const [cols, setCols] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setTitle(defaultTitle); }, [open, defaultTitle]);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const { evaluatePrompt } = await import("@/lib/engines/evaluator");
      const rec = await repo.createPrompt({
        title: title.trim().slice(0, 200), content, target, category, spec, projectId,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20), collectionIds: cols,
        score: evaluatePrompt(content).overall,
      });
      toast("Prompt guardado na biblioteca.");
      onSaved?.(rec.id);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao guardar.", "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Guardar na biblioteca" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" icon={<Save className="size-4" />} loading={busy} disabled={!title.trim()} onClick={save}>Guardar</Button></>}>
      <div className="space-y-4">
        <Field label="Título" htmlFor="sp-title" error={!title.trim() ? "O título é obrigatório." : undefined}><Input id="sp-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus /></Field>
        <Field label="Etiquetas" hint="Separadas por vírgulas" htmlFor="sp-tags"><Input id="sp-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ex.: cliente, mvp" /></Field>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted">Coleções</div>
          {collections?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {collections.map((c) => (
                <button key={c.id} type="button" onClick={() => setCols((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} className={cx("rounded-md border px-2.5 py-1 text-xs", cols.includes(c.id) ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted hover:text-fg")}>{c.name}</button>
              ))}
            </div>
          ) : <p className="text-xs text-faint">Ainda não tens coleções. Podes criá-las na biblioteca.</p>}
        </div>
        <p className="text-xs text-faint">Destino: {MODEL_PROFILES[target].label} · Categoria: {CATEGORIES.find((c) => c.id === category)?.label}</p>
      </div>
    </Modal>
  );
}

/* ---------- Painel de saída: pré-visualização + ações ---------- */
export function PromptOutput({ content, onContentChange, target, category, spec, projectId, title, onSaved }: {
  content: string; onContentChange?: (s: string) => void; target: TargetModel; category: CategoryId; spec?: PromptSpec; projectId?: string; title: string; onSaved?: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const stats = useMemo(() => ({ chars: content.length, words: content.trim() ? content.trim().split(/\s+/).length : 0, tokens: Math.ceil(content.length / 4) }), [content]);
  return (
    <Card
      title="Prompt final"
      subtitle={`${stats.words} palavras · ${stats.chars} caracteres · ~${stats.tokens} tokens (estimativa)`}
      action={
        <div className="flex flex-wrap justify-end gap-1.5">
          {onContentChange && <AiRefineButton content={content} onResult={onContentChange} />}
          <CopyButton text={content} />
          <Button size="sm" icon={<Download className="size-3.5" />} onClick={() => exportPrompt(title, content, "md", { target: MODEL_PROFILES[target].label, category })}>.md</Button>
          <Button size="sm" icon={<Download className="size-3.5" />} onClick={() => exportPrompt(title, content, "txt")}>.txt</Button>
          <Button size="sm" icon={<ClipboardCheck className="size-3.5" />} onClick={() => { setHandoff({ content, target, category }); router.push("/evaluator"); }}>Avaliar</Button>
          <Button size="sm" variant="primary" icon={<Save className="size-3.5" />} onClick={() => setSaving(true)}>Guardar</Button>
        </div>
      }
    >
      {onContentChange ? (
        <Textarea aria-label="Prompt final (editável)" className="prose-prompt min-h-[420px] bg-bg" value={content} onChange={(e) => onContentChange(e.target.value)} />
      ) : (
        <pre className="prose-prompt max-h-[560px] overflow-auto rounded-lg border border-line bg-bg p-4">{content}</pre>
      )}
      <SavePromptModal open={saving} onClose={() => setSaving(false)} content={content} target={target} category={category} spec={spec} projectId={projectId} defaultTitle={title} onSaved={onSaved} />
    </Card>
  );
}

/* ---------- Resultado da avaliação ---------- */
export function EvaluationView({ evaluation }: { evaluation: PromptEvaluation }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-line bg-surface p-5">
        <ScoreRing score={evaluation.overall} size={84} label="global" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">Avaliação heurística do prompt</div>
          <p className="mt-0.5 text-xs text-muted">Mede estrutura e especificidade do texto. Não garante a qualidade da resposta do modelo.</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {evaluation.detectedSections.map((s) => <Badge key={s} tone="ok">{s}</Badge>)}
            {evaluation.missingSections.map((s) => <Badge key={s} className="line-through decoration-faint">{s}</Badge>)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {evaluation.criteria.map((c) => (
          <div key={c.key} className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-2 flex justify-between text-[13px]"><span className="font-medium">{c.label}</span><span className="tabular-nums text-muted">{c.score}</span></div>
            <ScoreBar score={c.score} />
            <ul className="mt-2 space-y-0.5">{c.notes.map((n, i) => <li key={i} className="text-xs text-muted">{n}</li>)}</ul>
          </div>
        ))}
      </div>
      {evaluation.suggestions.length > 0 && (
        <Card title="Sugestões de melhoria">
          <ol className="list-decimal space-y-1.5 pl-5">{evaluation.suggestions.map((s, i) => <li key={i} className="text-[13px] text-fg/90">{s}</li>)}</ol>
        </Card>
      )}
    </div>
  );
}

export function CategorySelect({ value, onChange, allowAuto }: { value: CategoryId | "auto"; onChange: (v: CategoryId | "auto") => void; allowAuto?: boolean }) {
  return (
    <Select aria-label="Categoria" value={value} onChange={(e) => onChange(e.target.value as CategoryId | "auto")}>
      {allowAuto && <option value="auto">Detetar automaticamente</option>}
      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
    </Select>
  );
}
