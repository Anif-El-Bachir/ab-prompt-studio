"use client";

import { useState } from "react";
import { Boxes, Download, PenTool } from "lucide-react";
import { PageHeader } from "@/components/Sidebar";
import { Button, Card, EmptyState, Field, Textarea } from "@/components/ui";
import { useToast } from "@/components/feedback";
import { ArchitectureView, architectureToMarkdown } from "@/components/ArchitectureView";
import { AiRefineButton, CategorySelect, PromptOutput } from "@/components/PromptKit";
import { interpret } from "@/lib/engines/interpret";
import { designSystem } from "@/lib/engines/system";
import { buildSpec, renderPrompt } from "@/lib/engines/architect";
import { downloadText } from "@/lib/download";
import { useRepo, useSettings } from "@/lib/hooks";
import { truncate } from "@/lib/text";
import type { Architecture, CategoryId, Interpretation } from "@/lib/types";

export default function SystemArchitect() {
  const repo = useRepo();
  const toast = useToast();
  const [settings] = useSettings();
  const [text, setText] = useState("");
  const [cat, setCat] = useState<CategoryId | "auto">("auto");
  const [interp, setInterp] = useState<Interpretation>();
  const [arch, setArch] = useState<Architecture>();
  const [prompt, setPrompt] = useState("");
  const [review, setReview] = useState("");

  async function run() {
    if (text.trim().length < 10) { toast("Descreve o sistema com mais detalhe.", "bad"); return; }
    const i = interpret(text, cat === "auto" ? undefined : cat);
    const a = designSystem(i);
    setInterp(i); setArch(a); setPrompt(""); setReview("");
    await repo.log("architecture.created", `Arquitetura gerada: ${truncate(i.objective, 70)}`);
  }

  return (
    <>
      <PageHeader title="System Architect" description="Transforma uma ideia numa arquitetura técnica: camadas, componentes, dados, APIs, segurança, pastas e fases." />
      <div className="space-y-4">
        <Card>
          <div className="space-y-3">
            <Textarea aria-label="Descrição do sistema" rows={5} maxLength={20000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Plataforma SaaS para clínicas marcarem consultas, com login de pacientes, pagamentos e lembretes por email. Python no backend." />
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Field label="Categoria"><CategorySelect value={cat} onChange={setCat} allowAuto /></Field>
              <Button variant="primary" icon={<Boxes className="size-4" />} onClick={run} disabled={text.trim().length < 10}>Gerar arquitetura</Button>
            </div>
          </div>
        </Card>

        {arch && interp ? (
          <>
            <Card title="Arquitetura proposta" action={
              <div className="flex flex-wrap gap-1.5">
                <AiRefineButton task="review-architecture" label="Rever com IA" content={architectureToMarkdown(arch)} onResult={setReview} />
                <Button size="sm" icon={<Download className="size-3.5" />} onClick={() => downloadText("arquitetura.md", architectureToMarkdown(arch), "text/markdown")}>.md</Button>
                <Button size="sm" variant="primary" icon={<PenTool className="size-3.5" />} onClick={() => setPrompt(renderPrompt(buildSpec(interp, arch), { target: settings.defaultTarget, detail: settings.detail, responseLanguage: settings.responseLanguage, sourceText: text, customModel: settings.customModel }))}>Gerar prompt de implementação</Button>
              </div>
            }>
              <ArchitectureView arch={arch} />
            </Card>
            {review && <Card title="Revisão do modelo de IA" subtitle="Resposta externa — avalia criticamente."><pre className="prose-prompt font-sans text-[13px]">{review}</pre></Card>}
            {prompt && <PromptOutput content={prompt} onContentChange={setPrompt} target={settings.defaultTarget} category={interp.category} spec={buildSpec(interp, arch)} title={`Implementação — ${truncate(interp.objective, 60)}`} />}
          </>
        ) : (
          <EmptyState icon={<Boxes className="size-6" />} title="Descreve o sistema que queres construir" text="A arquitetura é gerada localmente a partir da tua descrição. Tecnologias que mencionares (ex.: Django, MongoDB) são respeitadas." />
        )}
      </div>
    </>
  );
}
