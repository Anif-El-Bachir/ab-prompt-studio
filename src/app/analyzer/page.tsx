"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Lightbulb, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/Sidebar";
import { Button, Card, EmptyState, Field, Textarea } from "@/components/ui";
import { ConfirmDialog, useToast } from "@/components/feedback";
import { AnalysisView } from "@/components/AnalysisView";
import { AiRefineButton, CategorySelect, InjectionNotice } from "@/components/PromptKit";
import { interpret } from "@/lib/engines/interpret";
import { analyzeIdea } from "@/lib/engines/analyzer";
import { useLive, useRepo } from "@/lib/hooks";
import { timeAgo } from "@/lib/download";
import { truncate } from "@/lib/text";
import type { AnalysisRecord, CategoryId, InjectionWarning } from "@/lib/types";

export default function Analyzer() {
  const repo = useRepo();
  const toast = useToast();
  const router = useRouter();
  const { data: history } = useLive((r) => r.listAnalyses());
  const [idea, setIdea] = useState("");
  const [cat, setCat] = useState<CategoryId | "auto">("auto");
  const [current, setCurrent] = useState<AnalysisRecord>();
  const [warnings, setWarnings] = useState<InjectionWarning[]>([]);
  const [aiText, setAiText] = useState("");
  const [toDelete, setToDelete] = useState<AnalysisRecord>();

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || !history) return;
    const rec = history.find((h) => h.id === id);
    if (rec && current?.id !== rec.id) { setCurrent(rec); setIdea(rec.idea); }
  }, [history, current?.id]);

  async function run() {
    if (idea.trim().length < 10) { toast("Descreve a ideia com mais detalhe.", "bad"); return; }
    const interp = interpret(idea, cat === "auto" ? undefined : cat);
    setWarnings(interp.injectionWarnings);
    const result = analyzeIdea(interp);
    const rec = await repo.saveAnalysis({ title: truncate(interp.objective, 90), idea, category: interp.category, result });
    setCurrent(rec);
    setAiText("");
    window.history.replaceState(null, "", `/analyzer?id=${rec.id}`);
  }

  async function toProject() {
    if (!current) return;
    const interp = interpret(current.idea);
    const p = await repo.saveProject({ title: current.title, idea: current.idea, status: "analysed", category: current.category, step: 1, interpretation: interp, answers: {}, analysis: current.result });
    router.push(`/new?project=${p.id}`);
  }

  return (
    <>
      <PageHeader title="Idea Analyzer" description="Avalia clareza, viabilidade, complexidade, recursos, tempo, riscos e alternativas. As pontuações são indicadores, não probabilidades." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <Card>
            <div className="space-y-3">
              <Textarea aria-label="Ideia" rows={6} maxLength={20000} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Descreve a ideia, negócio ou objetivo. Inclui público, orçamento, prazo e restrições se souberes." />
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Field label="Categoria"><CategorySelect value={cat} onChange={setCat} allowAuto /></Field>
                <div className="flex flex-wrap gap-2">
                  <AiRefineButton task="analyze-idea" label="Segunda opinião com IA" content={idea} onResult={setAiText} />
                  <Button variant="primary" icon={<Lightbulb className="size-4" />} onClick={run} disabled={idea.trim().length < 10}>Analisar ideia</Button>
                </div>
              </div>
            </div>
          </Card>
          <InjectionNotice warnings={warnings} />
          {aiText && <Card title="Análise do modelo de IA" subtitle="Resposta externa — confirma os factos."><pre className="prose-prompt font-sans text-[13px]">{aiText}</pre></Card>}
          {current ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium">{current.title}</h2>
                <Button size="sm" icon={<FolderPlus className="size-3.5" />} onClick={toProject}>Continuar como projeto</Button>
              </div>
              <AnalysisView analysis={current.result} />
            </>
          ) : (
            <EmptyState icon={<Lightbulb className="size-6" />} title="Nenhuma análise selecionada" text="Escreve uma ideia e clica em Analisar. Cada análise fica guardada no histórico." />
          )}
        </div>
        <Card title="Histórico" subtitle={`${history?.length ?? 0} análise(s)`} className="h-fit">
          {history?.length ? (
            <ul className="-mx-2 space-y-0.5">
              {history.map((h) => (
                <li key={h.id} className="group flex items-center gap-1">
                  <button onClick={() => { setCurrent(h); setIdea(h.idea); setAiText(""); window.history.replaceState(null, "", `/analyzer?id=${h.id}`); }} className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-left hover:bg-raised ${current?.id === h.id ? "bg-raised" : ""}`}>
                    <div className="truncate text-[13px]">{h.title}</div>
                    <div className="text-[11px] text-faint">{timeAgo(h.createdAt)}</div>
                  </button>
                  <button aria-label={`Eliminar análise ${h.title}`} onClick={() => setToDelete(h)} className="rounded p-1 text-faint opacity-0 hover:text-bad group-hover:opacity-100 focus:opacity-100"><Trash2 className="size-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-faint">Vazio.</p>}
        </Card>
      </div>
      <ConfirmDialog open={!!toDelete} danger onCancel={() => setToDelete(undefined)} onConfirm={async () => { if (toDelete) { await repo.deleteAnalysis(toDelete.id); if (current?.id === toDelete.id) setCurrent(undefined); toast("Análise eliminada."); } setToDelete(undefined); }} title="Eliminar análise?" text={`"${toDelete?.title}" será removida do histórico.`} confirmLabel="Eliminar" />
    </>
  );
}
