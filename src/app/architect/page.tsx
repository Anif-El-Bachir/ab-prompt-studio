"use client";

import { useEffect, useMemo, useState } from "react";
import { PenTool, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/Sidebar";
import { Badge, Button, Card, Field, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/feedback";
import { CategorySelect, InjectionNotice, PromptOutput, QuestionsForm, SpecEditor, TargetPicker } from "@/components/PromptKit";
import { applyAnswers, clarify, interpret } from "@/lib/engines/interpret";
import { buildSpec, renderPrompt } from "@/lib/engines/architect";
import { CATEGORIES, getCategory } from "@/lib/engines/categories";
import { useSettings } from "@/lib/hooks";
import { truncate } from "@/lib/text";
import type { Answers, CategoryId, ClarificationQuestion, DetailLevel, Interpretation, PromptSpec, TargetModel } from "@/lib/types";

const EXAMPLES: Partial<Record<CategoryId, string>> = {
  software: "Refatorar a API de encomendas em Node.js para usar validação com Zod e adicionar testes.",
  website: "Landing page para um estúdio de fotografia em Lisboa, com portfólio e formulário de marcação.",
  agent: "Agente que lê os emails de suporte, classifica-os e propõe respostas para aprovação humana.",
  marketing: "3 anúncios para Instagram para lançar um curso online de Excel para pequenos empresários.",
  data: "Analisar um CSV de vendas de 2025 para perceber sazonalidade e produtos com maior margem.",
  security: "Checklist de hardening para o servidor Linux da minha empresa que aloja o site.",
};

export default function PromptArchitect() {
  const toast = useToast();
  const [settings] = useSettings();
  const [text, setText] = useState("");
  const [cat, setCat] = useState<CategoryId | "auto">("auto");
  const [interp, setInterp] = useState<Interpretation>();
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [spec, setSpec] = useState<PromptSpec>();
  const [target, setTarget] = useState<TargetModel>("claude");
  const [detail, setDetail] = useState<DetailLevel>("standard");
  const [content, setContent] = useState("");
  const [manual, setManual] = useState(false);

  useEffect(() => { setTarget(settings.defaultTarget); setDetail(settings.detail); }, [settings.defaultTarget, settings.detail]);

  useEffect(() => {
    if (!spec || manual) return;
    setContent(renderPrompt(spec, { target, detail, responseLanguage: settings.responseLanguage, sourceText: text, customModel: settings.customModel }));
  }, [spec, target, detail, manual, text, settings.responseLanguage, settings.customModel]);

  function analyse() {
    if (text.trim().length < 5) { toast("Escreve o que pretendes.", "bad"); return; }
    const i = interpret(text, cat === "auto" ? undefined : cat);
    setInterp(i);
    setQuestions(clarify(i));
    setAnswers({});
    setSpec(undefined);
    setContent("");
  }

  function generate() {
    if (!interp) return;
    const e = applyAnswers(interp, answers, questions);
    setSpec(buildSpec(e));
    setManual(false);
  }

  const title = useMemo(() => truncate(interp?.objective ?? "Prompt", 80), [interp]);

  return (
    <>
      <PageHeader title="Prompt Architect" description="Transforma uma descrição simples num prompt profissional em 10 secções, adaptado ao modelo de destino." />
      <div className="space-y-4">
        <Card>
          <div className="space-y-3">
            <Textarea aria-label="Descrição do pedido" rows={5} maxLength={20000} value={text} onChange={(e) => setText(e.target.value)} placeholder="O que queres que a IA faça? Ex.: criar uma landing page para o meu ginásio…" />
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-faint">Exemplos:</span>
              {Object.entries(EXAMPLES).map(([k, v]) => (
                <button key={k} onClick={() => { setText(v!); setCat(k as CategoryId); }} className="rounded-md border border-line px-2 py-0.5 text-[11px] text-muted hover:border-line-strong hover:text-fg">{getCategory(k as CategoryId).short}</button>
              ))}
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Field label="Categoria"><CategorySelect value={cat} onChange={setCat} allowAuto /></Field>
              <Button variant="primary" icon={<PenTool className="size-4" />} onClick={analyse} disabled={text.trim().length < 5}>Interpretar pedido</Button>
            </div>
          </div>
        </Card>

        {interp && (
          <>
            <InjectionNotice warnings={interp.injectionWarnings} />
            <Card title="Interpretação e perguntas" subtitle={`${getCategory(interp.category).label} · confiança ${Math.round(interp.categoryConfidence * 100)}%`} action={<Badge tone="accent">{questions.length} pergunta(s)</Badge>}>
              <p className="mb-4 text-[13px]"><span className="text-muted">Objetivo:</span> {interp.objective}</p>
              <QuestionsForm questions={questions} answers={answers} onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />
              <div className="mt-4 flex justify-end"><Button variant="primary" onClick={generate}>{spec ? "Regenerar prompt" : "Gerar prompt"}</Button></div>
            </Card>
          </>
        )}

        {spec && interp && (
          <>
            <Card title="Modelo de destino e formato">
              <div className="space-y-4">
                <TargetPicker value={target} onChange={setTarget} />
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Nível de detalhe"><Select className="w-44" value={detail} onChange={(e) => setDetail(e.target.value as DetailLevel)}><option value="compact">Compacto</option><option value="standard">Normal</option><option value="detailed">Detalhado</option></Select></Field>
                  {manual && <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => setManual(false)}>Descartar edições manuais</Button>}
                </div>
                <details className="rounded-lg border border-line bg-bg p-3">
                  <summary className="cursor-pointer text-[13px] text-muted">Editar as 10 secções</summary>
                  <div className="mt-3"><SpecEditor spec={spec} onChange={(s) => { setSpec(s); setManual(false); }} /></div>
                </details>
              </div>
            </Card>
            <PromptOutput content={content} onContentChange={(c) => { setContent(c); setManual(true); }} target={target} category={interp.category} spec={spec} title={title} />
          </>
        )}

        {!interp && (
          <Card title="Categorias suportadas">
            <div className="flex flex-wrap gap-1.5">{CATEGORIES.map((c) => <Badge key={c.id}>{c.label}</Badge>)}</div>
          </Card>
        )}
      </div>
    </>
  );
}
