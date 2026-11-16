"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/Sidebar";
import { Badge, Button, Card, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { ConfirmDialog, useToast } from "@/components/feedback";
import { AnalysisView } from "@/components/AnalysisView";
import { ArchitectureView, architectureToMarkdown } from "@/components/ArchitectureView";
import { AiRefineButton, CategorySelect, EvaluationView, InjectionNotice, PromptOutput, QuestionsForm, SpecEditor, TargetPicker } from "@/components/PromptKit";
import { applyAnswers, clarify, interpret } from "@/lib/engines/interpret";
import { analyzeIdea } from "@/lib/engines/analyzer";
import { designSystem } from "@/lib/engines/system";
import { buildSpec, renderPrompt } from "@/lib/engines/architect";
import { evaluatePrompt } from "@/lib/engines/evaluator";
import { getCategory } from "@/lib/engines/categories";
import { useRepo, useSettings } from "@/lib/hooks";
import { STATUS_LABEL } from "@/lib/labels";
import { truncate } from "@/lib/text";
import type { Answers, Architecture, CategoryId, ClarificationQuestion, DetailLevel, IdeaAnalysis, Interpretation, ProjectStatus, PromptSpec, TargetModel } from "@/lib/types";

const PHASES = ["Input", "Interpretação", "Clarificação", "Validação", "Arquitetura", "Prompt", "Revisão"];

export default function NewProject() {
  const repo = useRepo();
  const toast = useToast();
  const [settings] = useSettings();

  const [projectId, setProjectId] = useState<string>();
  const [step, setStepRaw] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  /** Avançar invalida as fases seguintes (que dependem dos dados alterados). */
  const advanceTo = (s: number) => { setStepRaw(s); setMaxStep(s); };
  const setStep = (s: number | ((x: number) => number)) => setStepRaw(s);
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [cat, setCat] = useState<CategoryId | "auto">("auto");
  const [interp, setInterp] = useState<Interpretation>();
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [enriched, setEnriched] = useState<Interpretation>();
  const [analysis, setAnalysis] = useState<IdeaAnalysis>();
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [arch, setArch] = useState<Architecture>();
  const [useArch, setUseArch] = useState(true);
  const [spec, setSpec] = useState<PromptSpec>();
  const [target, setTarget] = useState<TargetModel>("claude");
  const [detail, setDetail] = useState<DetailLevel>("standard");
  const [content, setContent] = useState("");
  const [manual, setManual] = useState(false);
  const [status, setStatus] = useState<ProjectStatus>("draft");
  const [promptId, setPromptId] = useState<string>();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* Carregar projeto existente (?project=id) e definições */
  useEffect(() => {
    setTarget(settings.defaultTarget);
    setDetail(settings.detail);
  }, [settings.defaultTarget, settings.detail]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("project");
    if (!id) { setLoaded(true); return; }
    repo.getProject(id).then((p) => {
      if (!p) { toast("Projeto não encontrado.", "bad"); setLoaded(true); return; }
      setProjectId(p.id); setTitle(p.title); setIdea(p.idea); setStatus(p.status); setAnswers(p.answers ?? {});
      setPromptId(p.promptId);
      if (p.interpretation) {
        const i = p.interpretation as Interpretation;
        setInterp(i); setCat(i.categoryConfidence === 1 ? i.category : "auto");
        const qs = clarify(i); setQuestions(qs);
        const e = applyAnswers(i, p.answers ?? {}, qs); setEnriched(e);
      }
      if (p.analysis) setAnalysis(p.analysis);
      if (p.architecture) setArch(p.architecture);
      if (p.step >= 5 && p.interpretation) {
        const i = p.interpretation as Interpretation;
        setSpec(buildSpec(applyAnswers(i, p.answers ?? {}, clarify(i)), p.architecture));
      }
      setStep(Math.min(p.step, 6));
      setMaxStep(Math.min(p.step, 6));
      setLoaded(true);
    });
  }, [repo, toast]);

  const effective = enriched ?? interp;

  /* Regenera prompt a partir das secções enquanto não houver edição manual */
  useEffect(() => {
    if (!spec || manual) return;
    setContent(renderPrompt(spec, { target, detail, responseLanguage: settings.responseLanguage, sourceText: idea, customModel: settings.customModel }));
  }, [spec, target, detail, manual, idea, settings.responseLanguage, settings.customModel]);

  const evaluation = useMemo(() => (step === 6 && content ? evaluatePrompt(content) : undefined), [step, content]);

  async function persist(nextStep: number, patch: Partial<{ status: ProjectStatus; interpretation: Interpretation; analysis: IdeaAnalysis; architecture: Architecture; promptId: string }> = {}) {
    const e = patch.interpretation ?? effective;
    const st = patch.status ?? (status === "draft" && nextStep >= 4 ? "analysed" : status);
    setStatus(st);
    const rec = await repo.saveProject({
      id: projectId,
      title: title.trim() || truncate(e?.objective ?? idea, 80) || "Projeto sem título",
      idea,
      status: st,
      category: e?.category ?? "business",
      step: nextStep,
      interpretation: interp ?? e,
      answers,
      analysis: patch.analysis ?? analysis,
      architecture: patch.architecture ?? arch,
      promptId: patch.promptId ?? promptId,
    });
    if (!projectId) {
      setProjectId(rec.id);
      window.history.replaceState(null, "", `/new?project=${rec.id}`);
    }
    if (!title.trim()) setTitle(rec.title);
  }

  async function next() {
    try {
      if (step === 0) {
        if (idea.trim().length < 10) { toast("Descreve a ideia com pelo menos algumas palavras.", "bad"); return; }
        const i = interpret(idea, cat === "auto" ? undefined : cat);
        setInterp(i); setEnriched(undefined);
        setQuestions(clarify(i));
        setSpec(undefined); setManual(false); setAnalysis(undefined); setArch(undefined);
        advanceTo(1);
        await persist(1, { interpretation: i });
      } else if (step === 1) {
        advanceTo(2); await persist(2, { interpretation: interp });
      } else if (step === 2) {
        if (!interp) return;
        const e = applyAnswers(interp, answers, questions);
        setEnriched(e);
        const a = analyzeIdea(e);
        setAnalysis(a);
        advanceTo(3); await persist(3, { analysis: a, interpretation: interp });
      } else if (step === 3) {
        const a = effective ? designSystem(effective) : undefined;
        setArch(a);
        advanceTo(4); await persist(4, { architecture: a });
        if (a) await repo.log("architecture.created", `Arquitetura gerada: ${title || truncate(effective?.objective ?? "", 60)}`, projectId);
      } else if (step === 4) {
        if (!effective) return;
        setSpec(buildSpec(effective, useArch ? arch : undefined)); setManual(false);
        advanceTo(5); await persist(5, { status: status === "done" ? "done" : "in-development" });
      } else if (step === 5) {
        advanceTo(6); await persist(6);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao guardar o projeto.", "bad");
    }
  }

  function back() { setStep((s) => Math.max(0, s - 1)); }

  function reset() {
    setProjectId(undefined); advanceTo(0); setTitle(""); setIdea(""); setCat("auto"); setInterp(undefined); setEnriched(undefined);
    setQuestions([]); setAnswers({}); setAnalysis(undefined); setAiAnalysis(""); setArch(undefined); setSpec(undefined); setContent("");
    setManual(false); setStatus("draft"); setPromptId(undefined);
    window.history.replaceState(null, "", "/new");
  }

  const canNext = step === 0 ? idea.trim().length >= 10 : step < 6;
  const missingRequired = questions.filter((q) => q.required && !answers[q.id]?.trim()).length;

  if (!loaded) return <p className="text-sm text-muted">A carregar…</p>;

  return (
    <>
      <PageHeader
        title={projectId ? title || "Projeto" : "New Project"}
        description="Da ideia ao prompt final em 7 fases. O progresso é guardado automaticamente a cada fase."
        actions={
          <>
            {projectId && <Badge tone={STATUS_LABEL[status].tone} className="h-8 px-2.5">{STATUS_LABEL[status].label}</Badge>}
            {projectId && <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirmDelete(true)}>Eliminar</Button>}
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => (idea ? setConfirmReset(true) : reset())}>Novo</Button>
          </>
        }
      />

      {/* Stepper */}
      <ol className="mb-6 flex gap-1 overflow-x-auto pb-1" aria-label="Fases">
        {PHASES.map((p, i) => {
          const reachable = i <= maxStep;
          return (
            <li key={p} className="min-w-[96px] flex-1">
              <button
                disabled={!reachable}
                onClick={() => setStep(i)}
                className={cx("w-full rounded-lg border px-2.5 py-2 text-left transition-colors", i === step ? "border-accent/50 bg-accent/5" : reachable ? "border-line hover:border-line-strong" : "border-line/60 opacity-50")}
                aria-current={i === step ? "step" : undefined}
              >
                <div className="flex items-center gap-1.5 text-[10.5px] text-faint">
                  {i < maxStep && i !== step ? <Check className="size-3 text-ok" /> : <span className="tabular-nums">{i + 1}</span>} Fase
                </div>
                <div className={cx("text-[12.5px]", i === step ? "text-accent" : "text-fg/90")}>{p}</div>
              </button>
            </li>
          );
        })}
      </ol>

      {step === 0 && (
        <Card title="Fase 1 — Input" subtitle="Escreve livremente: o que queres fazer, para quem, com que recursos e restrições.">
          <div className="space-y-4">
            <Textarea
              aria-label="Descrição da ideia"
              rows={10}
              maxLength={20000}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder={"Ex.: Quero criar uma aplicação web para pequenos restaurantes gerirem reservas e encomendas online.\n- Login de funcionários\n- Pagamentos com MB WAY\nOrçamento de 8 000 € e prazo de 3 meses."}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Título do projeto (opcional)" htmlFor="np-title"><Input id="np-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Gerado a partir do objetivo" /></Field>
              <Field label="Categoria" hint="Deteção automática por palavras-chave, ou escolhe manualmente."><CategorySelect value={cat} onChange={setCat} allowAuto /></Field>
            </div>
            <p className="text-xs text-faint">{idea.length.toLocaleString("pt-PT")} / 20 000 caracteres. O texto é processado localmente; nada é enviado para fora sem ação tua.</p>
          </div>
        </Card>
      )}

      {step === 1 && interp && (
        <div className="space-y-4">
          <InjectionNotice warnings={interp.injectionWarnings} />
          <Card title="Fase 2 — Interpretação" subtitle="O que o sistema entendeu. Corrige o que estiver errado antes de avançar.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Objetivo identificado" htmlFor="obj"><Textarea id="obj" rows={3} value={interp.objective} onChange={(e) => setInterp({ ...interp, objective: e.target.value })} /></Field>
              <Field label="Resultado esperado" htmlFor="exp"><Textarea id="exp" rows={3} value={interp.expectedOutput} onChange={(e) => setInterp({ ...interp, expectedOutput: e.target.value })} /></Field>
              <Field label="Contexto" htmlFor="ctx"><Textarea id="ctx" rows={4} value={interp.context} onChange={(e) => setInterp({ ...interp, context: e.target.value })} placeholder="(sem contexto adicional)" /></Field>
              <div className="space-y-3">
                <Field label="Categoria">
                  <div className="flex items-center gap-2">
                    <CategorySelect value={interp.category} onChange={(v) => { if (v !== "auto") { const i = interpret(idea, v); setInterp({ ...i, objective: interp.objective, context: interp.context }); setQuestions(clarify(i)); } }} />
                    <Badge tone={interp.categoryConfidence >= 0.5 ? "ok" : interp.categoryConfidence >= 0.34 ? "warn" : "bad"}>confiança {Math.round(interp.categoryConfidence * 100)}%</Badge>
                  </div>
                </Field>
                <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
                  <dt className="text-muted">Público</dt><dd>{interp.audience ?? <span className="text-faint">não indicado</span>}</dd>
                  <dt className="text-muted">Orçamento</dt><dd>{interp.budget?.text ?? <span className="text-faint">não indicado</span>}</dd>
                  <dt className="text-muted">Prazo</dt><dd>{interp.deadline ? `${interp.deadline.text} (~${interp.deadline.weeks} sem.)` : <span className="text-faint">não indicado</span>}</dd>
                  <dt className="text-muted">Plataformas</dt><dd>{interp.platforms.join(", ") || <span className="text-faint">—</span>}</dd>
                  <dt className="text-muted">Tecnologias</dt><dd>{interp.technologies.join(", ") || <span className="text-faint">—</span>}</dd>
                </dl>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div><div className="mb-1.5 text-xs font-medium text-muted">Funcionalidades / requisitos detetados</div>{interp.features.length ? <ul className="space-y-1">{interp.features.map((f, i) => <li key={i} className="text-[13px]">· {f}</li>)}</ul> : <p className="text-xs text-faint">Nenhum detetado.</p>}</div>
              <div><div className="mb-1.5 text-xs font-medium text-muted">Restrições detetadas</div>{interp.constraints.length ? <ul className="space-y-1">{interp.constraints.map((f, i) => <li key={i} className="text-[13px]">· {f}</li>)}</ul> : <p className="text-xs text-faint">Nenhuma detetada.</p>}</div>
            </div>
          </Card>
        </div>
      )}

      {step === 2 && (
        <Card title="Fase 3 — Clarificação" subtitle={questions.length ? `${questions.length} pergunta(s) sobre informação em falta. Responder melhora a análise e o prompt.` : undefined}>
          <QuestionsForm questions={questions} answers={answers} onChange={(id, v) => setAnswers((a) => ({ ...a, [id]: v }))} />
          {missingRequired > 0 && <p className="mt-3 text-xs text-warn">{missingRequired} pergunta(s) essencial(is) sem resposta. Podes avançar, mas essas partes ficarão marcadas como desconhecidas.</p>}
        </Card>
      )}

      {step === 3 && analysis && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Fase 4 — Validação</h2>
            <AiRefineButton task="analyze-idea" label="Segunda opinião com IA" content={`${idea}\n\nRespostas de clarificação:\n${questions.map((q) => `- ${q.question} ${answers[q.id] ?? "(sem resposta)"}`).join("\n")}`} onResult={setAiAnalysis} />
          </div>
          <AnalysisView analysis={analysis} />
          {aiAnalysis && <Card title="Análise do modelo de IA" subtitle="Resposta externa — verifica os factos antes de decidir."><pre className="prose-prompt font-sans text-[13px]">{aiAnalysis}</pre></Card>}
        </div>
      )}

      {step === 4 && arch && (
        <Card title="Fase 5 — Arquitetura" action={<label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={useArch} onChange={(e) => setUseArch(e.target.checked)} className="accent-[var(--color-accent)]" /> Incluir no prompt</label>}>
          <ArchitectureView arch={arch} />
          <div className="mt-3"><AiRefineButton task="review-architecture" label="Rever com IA" content={architectureToMarkdown(arch)} onResult={setAiAnalysis} /></div>
          {aiAnalysis && step === 4 && <pre className="prose-prompt mt-3 rounded-lg border border-line bg-bg p-4 font-sans text-[13px]">{aiAnalysis}</pre>}
        </Card>
      )}

      {step === 5 && spec && (
        <div className="space-y-4">
          <Card title="Fase 6 — Geração do prompt" subtitle="Escolhe o modelo de destino; o formato e as instruções adaptam-se.">
            <div className="space-y-4">
              <TargetPicker value={target} onChange={setTarget} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nível de detalhe"><Select value={detail} onChange={(e) => setDetail(e.target.value as DetailLevel)}><option value="compact">Compacto</option><option value="standard">Normal</option><option value="detailed">Detalhado</option></Select></Field>
                {manual && <div className="flex items-end"><Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => setManual(false)}>Descartar edições manuais e regenerar</Button></div>}
              </div>
              <details className="rounded-lg border border-line bg-bg p-3">
                <summary className="cursor-pointer text-[13px] text-muted">Editar as 10 secções do prompt</summary>
                <div className="mt-3"><SpecEditor spec={spec} onChange={(s) => { setSpec(s); setManual(false); }} /></div>
              </details>
            </div>
          </Card>
          <PromptOutput content={content} onContentChange={(c) => { setContent(c); setManual(true); }} target={target} category={effective?.category ?? "business"} spec={spec} projectId={projectId} title={title || "Prompt"} onSaved={async (id) => { setPromptId(id); await persist(5, { promptId: id }); }} />
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4">
          <Card title="Fase 7 — Revisão" subtitle="Avalia, ajusta e guarda. Podes voltar a qualquer fase.">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Estado do projeto">
                <Select value={status} onChange={async (e) => { const s = e.target.value as ProjectStatus; setStatus(s); await persist(6, { status: s }); toast("Estado atualizado."); }} className="w-56">
                  {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s].label}</option>)}
                </Select>
              </Field>
              {promptId ? <Link href={`/library/${promptId}`}><Button size="sm">Abrir prompt na biblioteca</Button></Link> : <p className="text-xs text-warn">O prompt ainda não foi guardado na biblioteca.</p>}
              <p className="text-xs text-faint">Categoria: {getCategory(effective?.category ?? "business").label}</p>
            </div>
          </Card>
          {evaluation && <EvaluationView evaluation={evaluation} />}
          {content && <PromptOutput content={content} onContentChange={(c) => { setContent(c); setManual(true); }} target={target} category={effective?.category ?? "business"} spec={spec} projectId={projectId} title={title || "Prompt"} onSaved={async (id) => { setPromptId(id); await persist(6, { promptId: id }); }} />}
          {!content && <p className="text-sm text-muted">Gera o prompt na fase 6 para o avaliar aqui.</p>}
        </div>
      )}

      {/* Navegação */}
      <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-3 border-t border-line bg-bg/90 py-3 backdrop-blur">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} disabled={step === 0} onClick={back}>Anterior</Button>
        {step < 6 && (
          <Button variant="primary" disabled={!canNext || (step === 5 && !content)} onClick={next}>
            {step === 0 ? "Interpretar" : step === 2 ? "Validar ideia" : step === 3 ? "Gerar arquitetura" : step === 4 ? "Gerar prompt" : step === 5 ? "Rever" : "Avançar"} <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      <ConfirmDialog open={confirmReset} onCancel={() => setConfirmReset(false)} onConfirm={() => { setConfirmReset(false); reset(); }} title="Começar um novo projeto?" text="O projeto atual continua guardado no Dashboard. O formulário será limpo." confirmLabel="Novo projeto" />
      <ConfirmDialog open={confirmDelete} danger onCancel={() => setConfirmDelete(false)} onConfirm={async () => { setConfirmDelete(false); if (projectId) { await repo.deleteProject(projectId); toast("Projeto eliminado."); } reset(); }} title="Eliminar projeto?" text="O projeto e a sua análise/arquitetura são removidos deste browser. Os prompts guardados na biblioteca mantêm-se. Esta ação não pode ser desfeita (exceto a partir de um backup)." confirmLabel="Eliminar" />
    </>
  );
}
