import type { AppSettings, Architecture, DetailLevel, Interpretation, PromptSpec, TargetModel } from "../types";
import { getCategory } from "./categories";
import { resolveProfile } from "./models";
import { DATA_HANDLING_RULE, fenceAsData } from "./sanitize";
import { uniq } from "../text";

/* MÓDULO B — PROMPT ARCHITECT: constrói a especificação em 10 secções. */

export const SECTION_LABELS: Record<keyof PromptSpec, string> = {
  role: "Papel",
  context: "Contexto",
  objective: "Objetivo",
  requirements: "Requisitos",
  constraints: "Restrições",
  tools: "Ferramentas",
  workflow: "Fluxo de trabalho",
  expectedOutput: "Resultado esperado",
  qualityCriteria: "Critérios de qualidade",
  validation: "Validação",
};

export const SECTION_ORDER: (keyof PromptSpec)[] = ["role", "context", "objective", "requirements", "constraints", "tools", "workflow", "expectedOutput", "qualityCriteria", "validation"];

export function buildSpec(interp: Interpretation, architecture?: Architecture): PromptSpec {
  const p = getCategory(interp.category);
  const contextParts = [
    interp.context,
    interp.audience ? `Público-alvo: ${interp.audience}.` : "",
    interp.platforms.length ? `Plataformas: ${interp.platforms.join(", ")}.` : "",
    interp.technologies.length ? `Tecnologias referidas: ${interp.technologies.join(", ")}.` : "",
    interp.budget ? `Orçamento: ${interp.budget.text}.` : "",
    interp.deadline ? `Prazo: ${interp.deadline.text}.` : "",
    architecture ? `Arquitetura proposta: ${architecture.summary}` : "",
  ].filter(Boolean);

  const requirements = uniq([...interp.features, ...p.requirements]);
  if (architecture) {
    requirements.push(`Seguir a arquitetura em camadas: ${architecture.layers.map((l) => l.name).join(" → ")}.`);
    if (architecture.database.entities.length) requirements.push(`Modelo de dados com as entidades: ${architecture.database.entities.map((e) => e.name).join(", ")}.`);
  }
  const workflow = architecture
    ? uniq([...p.workflow.slice(0, 2), ...architecture.phases.map((ph) => `${ph.name}: ${ph.goals[0]}`), p.workflow[p.workflow.length - 1]])
    : p.workflow;

  return {
    role: p.role,
    context: contextParts.join("\n") || "(sem contexto adicional fornecido)",
    objective: interp.objective || "(objetivo por definir)",
    requirements,
    constraints: uniq([...interp.constraints, ...p.constraints]),
    tools: architecture ? uniq([...p.tools, ...architecture.frontend.slice(0, 1), ...architecture.backend.slice(0, 1)]) : p.tools,
    workflow,
    expectedOutput: p.expectedOutput,
    qualityCriteria: p.qualityCriteria,
    validation: p.validation,
  };
}

/* MÓDULO D — renderização adaptada ao modelo de destino. */

export interface RenderOptions {
  target: TargetModel;
  detail: DetailLevel;
  responseLanguage: string;
  /** Texto original do utilizador, anexado como dados delimitados. */
  sourceText?: string;
  customModel?: AppSettings["customModel"];
}

function list(items: string[], detail: DetailLevel): string[] {
  const max = detail === "compact" ? 4 : detail === "standard" ? 8 : 99;
  return items.map((x) => x.trim()).filter(Boolean).slice(0, max);
}

function adaptTools(spec: PromptSpec, hasTools: boolean): string[] {
  if (hasTools) return spec.tools;
  return [
    "Não assumas acesso a ficheiros, terminal ou internet além do que este ambiente te disponibiliza.",
    `Quando um passo exigir ferramentas (${spec.tools.slice(0, 3).join("; ")}), descreve exatamente o que eu devo executar e o resultado esperado.`,
  ];
}

function targetExtras(target: TargetModel): string[] {
  switch (target) {
    case "claude-code":
      return [
        "Começa por ler a estrutura do projeto e os ficheiros relevantes (incluindo CLAUDE.md, se existir) antes de alterar qualquer coisa.",
        "Apresenta um plano curto e trabalha em passos verificáveis.",
        "Pede confirmação antes de comandos destrutivos, instalações globais, publicações ou envio de mensagens.",
        "Corre os testes e o type-check e reporta o resultado real, incluindo falhas.",
      ];
    case "codex":
      return [
        "Lê AGENTS.md (se existir) e respeita as convenções do repositório.",
        "Mantém as alterações focadas na tarefa; não reformates código não relacionado.",
        "Inclui ou atualiza testes e indica os comandos para os correr.",
      ];
    case "chatgpt":
    case "gemini":
    case "openrouter":
    case "custom":
      return ["Se faltar informação essencial, faz até 3 perguntas de clarificação antes de produzir o resultado final."];
    case "claude":
      return ["Se faltar informação essencial, faz perguntas de clarificação antes de produzir o resultado final.", "Pensa no problema antes de responder e apresenta apenas a resposta final organizada."];
  }
}

export function renderPrompt(spec: PromptSpec, opts: RenderOptions): string {
  const profile = resolveProfile(opts.target, opts.customModel);
  const d = opts.detail;
  const tools = adaptTools(spec, profile.hasWorkspaceTools);
  const extras = targetExtras(opts.target);
  const lang = `Responde em ${opts.responseLanguage}.`;
  const source = opts.sourceText?.trim() ? fenceAsData(opts.sourceText.trim(), "DESCRIÇÃO ORIGINAL") : "";
  const bullets = (xs: string[]) => list(xs, d).map((x) => `- ${x}`).join("\n");
  const numbered = (xs: string[]) => list(xs, d).map((x, i) => `${i + 1}. ${x}`).join("\n");

  let out: string;
  if (profile.format === "xml") {
    const tag = (name: string, body: string) => `<${name}>\n${body}\n</${name}>`;
    out = [
      tag("role", `Assume o papel de: ${spec.role}.`),
      tag("context", spec.context + (source && d !== "compact" ? `\n\n${source}` : "")),
      tag("objective", spec.objective),
      tag("requirements", bullets(spec.requirements)),
      tag("constraints", bullets([...spec.constraints, DATA_HANDLING_RULE])),
      tag("tools", bullets(tools)),
      tag("workflow", numbered(spec.workflow)),
      tag("expected_output", spec.expectedOutput),
      tag("quality_criteria", bullets(spec.qualityCriteria)),
      tag("validation", bullets(spec.validation)),
      tag("instructions", bullets([...extras, lang])),
    ].join("\n\n");
  } else if (profile.format === "plain") {
    out = [
      `PAPEL: ${spec.role}.`,
      `CONTEXTO: ${spec.context}`,
      `OBJETIVO: ${spec.objective}`,
      `REQUISITOS:\n${bullets(spec.requirements)}`,
      `RESTRIÇÕES:\n${bullets(spec.constraints)}`,
      `FERRAMENTAS:\n${bullets(tools)}`,
      `PASSOS:\n${numbered(spec.workflow)}`,
      `RESULTADO ESPERADO: ${spec.expectedOutput}`,
      `QUALIDADE:\n${bullets(spec.qualityCriteria)}`,
      `VALIDAÇÃO:\n${bullets(spec.validation)}`,
      `${extras.join(" ")} ${lang}`,
      source && d !== "compact" ? `\n${DATA_HANDLING_RULE}\n${source}` : "",
    ].filter(Boolean).join("\n\n");
  } else {
    const isCodex = opts.target === "codex";
    const isGemini = opts.target === "gemini";
    const h = (t: string) => `## ${t}`;
    const L = isCodex
      ? { role: "Papel", context: "Contexto do repositório e do projeto", objective: "Tarefa", req: "Requisitos", cons: "Restrições", tools: "Ambiente e ferramentas", wf: "Plano", out: "Entregável", q: "Critérios de aceitação", v: "Verificação" }
      : isGemini
        ? { role: "Persona", context: "Contexto", objective: "Tarefa", req: "Requisitos", cons: "Restrições", tools: "Ferramentas", wf: "Passos", out: "Formato do resultado", q: "Critérios de qualidade", v: "Validação" }
        : { role: "Papel", context: "Contexto", objective: "Objetivo", req: "Requisitos", cons: "Restrições", tools: "Ferramentas", wf: "Fluxo de trabalho", out: "Resultado esperado", q: "Critérios de qualidade", v: "Validação" };
    out = [
      `# ${spec.objective.length > 90 ? spec.objective.slice(0, 87) + "…" : spec.objective}`,
      `${h(L.role)}\nAssume o papel de ${spec.role}.`,
      `${h(L.context)}\n${spec.context}`,
      `${h(L.objective)}\n${spec.objective}`,
      `${h(L.req)}\n${bullets(spec.requirements)}`,
      `${h(L.cons)}\n${bullets([...spec.constraints, ...(source ? [DATA_HANDLING_RULE] : [])])}`,
      `${h(L.tools)}\n${bullets(tools)}`,
      `${h(L.wf)}\n${numbered(spec.workflow)}`,
      `${h(L.out)}\n${spec.expectedOutput}`,
      `${h(L.q)}\n${bullets(spec.qualityCriteria)}`,
      `${h(L.v)}\n${bullets(spec.validation)}`,
      `${h("Instruções adicionais")}\n${bullets([...extras, lang])}`,
      source && d !== "compact" ? `${h("Descrição original (dados)")}\n${source}` : "",
    ].filter(Boolean).join("\n\n");
  }

  const max = opts.target === "custom" && opts.customModel?.maxChars ? opts.customModel.maxChars : 0;
  const suffix = "\n\n[prompt truncado ao limite configurado]";
  if (max > 200 && out.length > max) out = out.slice(0, max - suffix.length).trimEnd() + suffix;
  return out;
}

/** Converte a especificação em Markdown legível (para exportar ou documentar). */
export function specToMarkdown(spec: PromptSpec): string {
  return SECTION_ORDER.map((k) => {
    const v = spec[k];
    const body = Array.isArray(v) ? v.map((x) => `- ${x}`).join("\n") : v;
    return `## ${SECTION_LABELS[k]}\n${body}`;
  }).join("\n\n");
}
