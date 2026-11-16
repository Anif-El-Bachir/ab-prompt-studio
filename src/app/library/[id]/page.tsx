"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Copy as CopyIcon, Download, History, RotateCcw, Save, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/Sidebar";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { ConfirmDialog, CopyButton, Modal, useToast } from "@/components/feedback";
import { AiRefineButton } from "@/components/PromptKit";
import { useLive, useRepo } from "@/lib/hooks";
import { CATEGORIES, getCategory } from "@/lib/engines/categories";
import { MODEL_PROFILES, TARGETS } from "@/lib/engines/models";
import { evaluatePrompt } from "@/lib/engines/evaluator";
import { exportPrompt, timeAgo } from "@/lib/download";
import type { CategoryId, PromptVersion, TargetModel } from "@/lib/types";

/** Diferença linha a linha simples (LCS) para comparar versões. */
function lineDiff(a: string, b: string): { type: "same" | "add" | "del"; text: string }[] {
  const A = a.split("\n"), B = b.split("\n");
  if (A.length * B.length > 250_000) return [{ type: "same", text: "(texto demasiado longo para comparar)" }];
  const dp = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { type: "same" | "add" | "del"; text: string }[] = [];
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { out.push({ type: "same", text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: "del", text: A[i++] });
    else out.push({ type: "add", text: B[j++] });
  }
  while (i < A.length) out.push({ type: "del", text: A[i++] });
  while (j < B.length) out.push({ type: "add", text: B[j++] });
  return out;
}

export default function PromptDetail() {
  const { id } = useParams<{ id: string }>();
  const repo = useRepo();
  const router = useRouter();
  const toast = useToast();
  const { data, loading } = useLive(async (r) => ({ prompt: await r.getPrompt(id), versions: await r.listVersions(id), collections: await r.listCollections() }), [id]);
  const prompt = data?.prompt;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [target, setTarget] = useState<TargetModel>("claude");
  const [category, setCategory] = useState<CategoryId>("software");
  const [cols, setCols] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [viewing, setViewing] = useState<PromptVersion>();
  const [restoring, setRestoring] = useState<PromptVersion>();
  const [deleting, setDeleting] = useState(false);
  const [initFor, setInitFor] = useState<string>();

  useEffect(() => {
    if (!prompt || initFor === `${prompt.id}:${prompt.version}`) return;
    setTitle(prompt.title); setContent(prompt.content); setTags(prompt.tags.join(", ")); setTarget(prompt.target); setCategory(prompt.category); setCols(prompt.collectionIds);
    setInitFor(`${prompt.id}:${prompt.version}`);
  }, [prompt, initFor]);

  const dirty = !!prompt && (title !== prompt.title || content !== prompt.content || tags !== prompt.tags.join(", ") || target !== prompt.target || category !== prompt.category || cols.join() !== prompt.collectionIds.join());
  const score = useMemo(() => evaluatePrompt(content).overall, [content]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if (loading) return <p className="text-sm text-muted">A carregar…</p>;
  if (!prompt) return <EmptyState title="Prompt não encontrado" text="Pode ter sido eliminado." action={<Link href="/library"><Button size="sm">Voltar à biblioteca</Button></Link>} />;

  async function save() {
    if (!title.trim()) { toast("O título é obrigatório.", "bad"); return; }
    const r = await repo.updatePrompt(id, { title: title.trim(), content, tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20), target, category, collectionIds: cols, score }, note.trim());
    setNote("");
    toast(r.version !== prompt!.version ? `Guardado como v${r.version}.` : "Alterações guardadas.");
  }

  return (
    <>
      <Link href="/library" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ArrowLeft className="size-3.5" /> Biblioteca</Link>
      <PageHeader
        title={prompt.title}
        description={`${MODEL_PROFILES[prompt.target].label} · ${getCategory(prompt.category).label} · v${prompt.version} · atualizado ${timeAgo(prompt.updatedAt)}`}
        actions={
          <>
            <CopyButton text={content} size="md" />
            <Button icon={<Download className="size-4" />} onClick={() => exportPrompt(title, content, "md", { target: MODEL_PROFILES[target].label, category: getCategory(category).label, version: prompt.version })}>.md</Button>
            <Button icon={<Download className="size-4" />} onClick={() => exportPrompt(title, content, "txt")}>.txt</Button>
            <Link href={`/evaluator?id=${id}`}><Button icon={<ClipboardCheck className="size-4" />}>Avaliar</Button></Link>
            <Button variant="ghost" icon={<CopyIcon className="size-4" />} onClick={async () => { const d = await repo.duplicatePrompt(id); toast("Duplicado."); router.push(`/library/${d.id}`); }}>Duplicar</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setDeleting(true)} aria-label="Eliminar" />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Card title="Conteúdo" subtitle={`Pontuação heurística: ${score}/100`} action={<AiRefineButton content={content} onResult={setContent} />}>
            <div className="space-y-3">
              <Field label="Título" htmlFor="pd-title"><Input id="pd-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></Field>
              <Textarea aria-label="Conteúdo do prompt" className="prose-prompt min-h-[480px]" value={content} onChange={(e) => setContent(e.target.value)} />
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[220px] flex-1"><Field label="Nota da versão (opcional)" htmlFor="pd-note"><Input id="pd-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="O que mudou?" /></Field></div>
                <Button variant="primary" icon={<Save className="size-4" />} disabled={!dirty} onClick={save}>Guardar{content !== prompt.content || title !== prompt.title ? " nova versão" : ""}</Button>
                {dirty && <Button variant="ghost" onClick={() => setInitFor(undefined)}>Descartar</Button>}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Organização">
            <div className="space-y-3">
              <Field label="Modelo de destino"><Select value={target} onChange={(e) => setTarget(e.target.value as TargetModel)}>{TARGETS.map((t) => <option key={t} value={t}>{MODEL_PROFILES[t].label}</option>)}</Select></Field>
              <Field label="Categoria"><Select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
              <Field label="Etiquetas" hint="Separadas por vírgulas" htmlFor="pd-tags"><Input id="pd-tags" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted">Coleções</div>
                {data?.collections.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.collections.map((c) => (
                      <button key={c.id} onClick={() => setCols((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} className={cx("rounded-md border px-2 py-0.5 text-xs", cols.includes(c.id) ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted hover:text-fg")}>{c.name}</button>
                    ))}
                  </div>
                ) : <p className="text-xs text-faint">Cria coleções na biblioteca.</p>}
              </div>
              <p className="text-[11px] text-faint">Alterar só a organização não cria nova versão.</p>
            </div>
          </Card>

          <Card title="Versões" subtitle={`${data?.versions.length ?? 0} versão(ões)`} action={<History className="size-4 text-faint" />}>
            <ul className="-mx-2 space-y-0.5">
              {data?.versions.map((v) => (
                <li key={v.id} className="flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-raised">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setViewing(v)}>
                    <div className="flex items-center gap-1.5 text-[13px]"><Badge tone={v.version === prompt.version ? "accent" : "neutral"}>v{v.version}</Badge> <span className="truncate">{v.note}</span></div>
                    <div className="text-[11px] text-faint">{timeAgo(v.createdAt)}</div>
                  </button>
                  {v.version !== prompt.version && <button aria-label={`Restaurar v${v.version}`} onClick={() => setRestoring(v)} className="rounded p-1 text-faint hover:text-fg"><RotateCcw className="size-3.5" /></button>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Modal wide open={!!viewing} onClose={() => setViewing(undefined)} title={viewing ? `v${viewing.version} — ${viewing.note}` : ""} footer={viewing && viewing.version !== prompt.version ? <><CopyButton text={viewing.content} /><Button variant="primary" icon={<RotateCcw className="size-3.5" />} onClick={() => { setRestoring(viewing); setViewing(undefined); }}>Restaurar esta versão</Button></> : viewing ? <CopyButton text={viewing.content} /> : null}>
        {viewing && (
          <>
            <p className="mb-2 text-xs text-muted">Diferenças em relação à versão atual (v{prompt.version}): <span className="text-bad">− removido</span> · <span className="text-ok">+ acrescentado na atual</span></p>
            <pre className="prose-prompt max-h-[60vh] overflow-auto rounded-lg border border-line bg-bg p-3">
              {lineDiff(viewing.content, prompt.content).map((l, i) => (
                <div key={i} className={l.type === "add" ? "bg-ok/10 text-ok" : l.type === "del" ? "bg-bad/10 text-bad" : "text-muted"}>{l.type === "add" ? "+ " : l.type === "del" ? "− " : "  "}{l.text}</div>
              ))}
            </pre>
          </>
        )}
      </Modal>
      <ConfirmDialog open={!!restoring} onCancel={() => setRestoring(undefined)} onConfirm={async () => { if (restoring) { const r = await repo.restoreVersion(id, restoring.id); toast(`v${restoring.version} restaurada como v${r.version}.`); } setRestoring(undefined); }} title={`Restaurar v${restoring?.version}?`} text="É criada uma nova versão com esse conteúdo. O histórico mantém-se." confirmLabel="Restaurar" />
      <ConfirmDialog open={deleting} danger onCancel={() => setDeleting(false)} onConfirm={async () => { await repo.deletePrompt(id); toast("Prompt eliminado."); router.push("/library"); }} title="Eliminar prompt?" text="O prompt e todas as versões serão removidos deste browser. Só é recuperável a partir de um backup." confirmLabel="Eliminar" />
    </>
  );
}
