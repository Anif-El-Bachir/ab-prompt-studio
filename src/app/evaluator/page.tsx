"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Save, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/Sidebar";
import { Badge, Button, Card, Textarea } from "@/components/ui";
import { useToast } from "@/components/feedback";
import { AiRefineButton, EvaluationView, PromptOutput, TargetPicker } from "@/components/PromptKit";
import { evaluatePrompt, improvePrompt } from "@/lib/engines/evaluator";
import { interpret } from "@/lib/engines/interpret";
import { takeHandoff, useRepo, useSettings } from "@/lib/hooks";
import type { CategoryId, PromptRecord, TargetModel } from "@/lib/types";

export default function Evaluator() {
  const repo = useRepo();
  const toast = useToast();
  const [settings] = useSettings();
  const [text, setText] = useState("");
  const [evaluated, setEvaluated] = useState("");
  const [improved, setImproved] = useState("");
  const [target, setTarget] = useState<TargetModel>("claude");
  const [category, setCategory] = useState<CategoryId>();
  const [source, setSource] = useState<PromptRecord>();

  useEffect(() => { setTarget(settings.defaultTarget); }, [settings.defaultTarget]);

  useEffect(() => {
    const h = takeHandoff<{ content: string; target?: TargetModel; category?: CategoryId }>();
    if (h?.content) { setText(h.content); setEvaluated(h.content); if (h.target) setTarget(h.target); if (h.category) setCategory(h.category); return; }
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) repo.getPrompt(id).then((p) => { if (p) { setSource(p); setText(p.content); setEvaluated(p.content); setTarget(p.target); setCategory(p.category); } });
  }, [repo]);

  const evaluation = useMemo(() => (evaluated.trim() ? evaluatePrompt(evaluated) : undefined), [evaluated]);
  const improvedEval = useMemo(() => (improved.trim() ? evaluatePrompt(improved) : undefined), [improved]);

  async function evaluate() {
    if (!text.trim()) return;
    setEvaluated(text);
    setImproved("");
    await repo.log("evaluation.run", `Prompt avaliado (${evaluatePrompt(text).overall}/100)`, source?.id);
  }

  async function saveAsVersion(content: string) {
    if (!source) return;
    const updated = await repo.updatePrompt(source.id, { content, score: evaluatePrompt(content).overall }, "Versão melhorada no Evaluator");
    setSource(updated);
    toast(`Guardado como v${updated.version} de “${updated.title}”.`);
  }

  return (
    <>
      <PageHeader title="Prompt Evaluator" description="Avalia clareza, contexto, precisão, completude, estrutura, ambiguidades e critérios de sucesso, e gera uma versão melhorada." />
      <div className="space-y-4">
        {source && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            A avaliar da biblioteca: <Link href={`/library/${source.id}`} className="text-accent hover:underline">{source.title}</Link> <Badge>v{source.version}</Badge>
          </div>
        )}
        <Card>
          <div className="space-y-3">
            <Textarea aria-label="Prompt a avaliar" rows={10} className="prose-prompt" maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Cola aqui um prompt para avaliar…" />
            <div className="flex flex-wrap justify-end gap-2">
              <AiRefineButton content={text} onResult={setImproved} label="Melhorar com IA" />
              <Button variant="primary" icon={<ClipboardCheck className="size-4" />} disabled={!text.trim()} onClick={evaluate}>Avaliar</Button>
            </div>
          </div>
        </Card>

        {evaluation && (
          <>
            <EvaluationView evaluation={evaluation} />
            <Card title="Gerar nova versão" subtitle="Reestrutura o prompt nas 10 secções, mantendo o pedido original como contexto delimitado.">
              <div className="space-y-3">
                <TargetPicker value={target} onChange={setTarget} />
                <div className="flex justify-end">
                  <Button variant="primary" icon={<Wand2 className="size-4" />} onClick={() => setImproved(improvePrompt(evaluated, target, settings.responseLanguage, category ?? interpret(evaluated).category))}>Gerar versão melhorada</Button>
                </div>
              </div>
            </Card>
          </>
        )}

        {improved && improvedEval && (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-5 py-3 text-sm">
              <span className="text-muted">Pontuação</span>
              {evaluation && <><span className="tabular-nums">{evaluation.overall}</span><ArrowRight className="size-4 text-faint" /></>}
              <span className={`font-semibold tabular-nums ${!evaluation || improvedEval.overall > evaluation.overall ? "text-ok" : "text-warn"}`}>{improvedEval.overall}</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { setText(improved); setEvaluated(improved); setImproved(""); }}>Usar e reavaliar</Button>
                {source && <Button size="sm" variant="primary" icon={<Save className="size-3.5" />} onClick={() => saveAsVersion(improved)}>Guardar como nova versão</Button>}
              </div>
            </div>
            <PromptOutput content={improved} onContentChange={setImproved} target={target} category={category ?? interpret(evaluated || text).category} title={source ? `${source.title} (melhorado)` : "Prompt melhorado"} />
          </>
        )}
      </div>
    </>
  );
}
