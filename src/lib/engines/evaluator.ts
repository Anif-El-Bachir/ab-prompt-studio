import type { CategoryId, CriterionScore, PromptEvaluation, PromptSpec, TargetModel } from "../types";
import { clamp, matchedTerms, normalize, sentences } from "../text";
import { interpret } from "./interpret";
import { buildSpec, renderPrompt, SECTION_LABELS, SECTION_ORDER } from "./architect";

/* MÓDULO E — PROMPT EVALUATION: avaliação heurística de qualidade de prompts. */

const SECTION_SIGNALS: Record<keyof PromptSpec, string[]> = {
  role: ["papel", "role", "assume", "atua como", "age como", "act as", "you are", "es um", "persona", "especialista"],
  context: ["contexto", "context", "background", "cenario", "situacao", "projeto", "publico"],
  objective: ["objetivo", "objective", "goal", "tarefa", "task", "pretendo", "quero que", "missao"],
  requirements: ["requisitos", "requirements", "deve", "must", "obrigatorio", "precisa de", "inclui", "incluir"],
  constraints: ["restricoes", "constraints", "limitacoes", "nao deves", "nao pode", "evita", "evitar", "do not", "don't", "sem ", "nunca"],
  tools: ["ferramentas", "tools", "usa ", "utiliza", "api", "terminal", "biblioteca", "framework"],
  workflow: ["passos", "fluxo", "workflow", "etapas", "fases", "primeiro", "depois", "steps", "plano", "1."],
  expectedOutput: ["resultado esperado", "formato", "output", "entrega", "entregavel", "deliverable", "devolve", "responde com", "tabela", "json", "markdown"],
  qualityCriteria: ["criterios", "qualidade", "quality", "aceitacao", "acceptance", "sucesso", "definition of done"],
  validation: ["validacao", "validation", "verifica", "verificar", "testa", "testes", "confirma", "rever", "revisao", "check"],
};

const VAGUE = ["algo", "alguma coisa", "coisas", "etc", "qualquer", "bom", "boa", "melhor", "bonito", "interessante", "adequado", "varios", "alguns", "talvez", "mais ou menos", "something", "stuff", "nice", "good", "better", "some", "maybe", "whatever", "tipo"];
const PRONOUN_VAGUE = ["isto", "isso", "aquilo", "this thing", "that thing"];
const PRECISION = /(\d+\s*(%|palavras|words|caracteres|chars|segundos|minutos|px|ms|itens|linhas|slides|paginas|semanas|dias)|\b(exatamente|no maximo|no minimo|ate \d|at most|at least|exactly|entre \d+ e \d+)\b)/gi;

function hasSection(norm: string, key: keyof PromptSpec, raw: string): boolean {
  const headingRe = new RegExp(`(^|\\n)\\s*(#{1,4}\\s*|<|\\*\\*)?\\s*(${SECTION_LABELS[key]}|${key})`, "i");
  if (headingRe.test(raw)) return true;
  return SECTION_SIGNALS[key].some((s) => norm.includes(s));
}

export function evaluatePrompt(prompt: string): PromptEvaluation {
  const raw = prompt.trim();
  const norm = normalize(raw);
  const sents = sentences(raw);
  const wordCount = raw ? raw.split(/\s+/).length : 0;
  const avgLen = sents.length ? wordCount / sents.length : wordCount;

  const detected = SECTION_ORDER.filter((k) => hasSection(norm, k, raw));
  const missing = SECTION_ORDER.filter((k) => !detected.includes(k));
  const vague = matchedTerms(norm, VAGUE);
  const pron = matchedTerms(norm, PRONOUN_VAGUE);
  const precisionHits = (norm.match(PRECISION) ?? []).length;
  const headings = (raw.match(/^\s*(#{1,4}\s|<[a-z_]+>|\*\*[^*]+\*\*\s*:?$|[A-ZÇÃÕÉÁÍÓÚ ]{4,}:)/gm) ?? []).length;
  const bullets = (raw.match(/^\s*([-*•]|\d+[.)])\s+/gm) ?? []).length;
  const lines = raw.split(/\n/).filter((l) => l.trim()).length;

  const criteria: CriterionScore[] = [];

  /* Clareza */
  {
    const notes: string[] = [];
    let s = 70;
    if (wordCount < 15) { s -= 35; notes.push("Prompt muito curto."); }
    if (avgLen > 32) { s -= 15; notes.push(`Frases longas (média ${Math.round(avgLen)} palavras).`); }
    if (vague.length) { s -= Math.min(30, vague.length * 6); notes.push(`Termos vagos: ${vague.slice(0, 6).join(", ")}.`); }
    if (/\b(cria|escreve|gera|analisa|desenvolve|implementa|lista|resume|create|write|build|analyze|list)\b/i.test(norm)) { s += 15; notes.push("Usa verbos de ação claros."); }
    if (detected.includes("objective")) s += 10;
    criteria.push({ key: "clarity", label: "Clareza", score: clamp(s), notes });
  }
  /* Contextualização */
  {
    const notes: string[] = [];
    let s = detected.includes("context") ? 60 : 20;
    if (detected.includes("context")) notes.push("Existe contexto explícito."); else notes.push("Falta contexto (projeto, público, situação).");
    if (/(publico|audience|utilizadores|clientes|para quem)/.test(norm)) { s += 15; notes.push("Indica o público."); }
    if (detected.includes("role")) { s += 10; notes.push("Define o papel do modelo."); }
    if (wordCount > 120) s += 10;
    criteria.push({ key: "context", label: "Contextualização", score: clamp(s), notes });
  }
  /* Precisão */
  {
    const notes: string[] = [];
    let s = 35 + Math.min(40, precisionHits * 10);
    if (precisionHits) notes.push(`${precisionHits} especificação(ões) mensurável(eis).`); else notes.push("Sem quantidades, limites ou formatos concretos.");
    if (detected.includes("expectedOutput")) { s += 15; notes.push("Formato de saída definido."); }
    if (/(json|markdown|tabela|table|csv|lista numerada|xml)/.test(norm)) s += 10;
    criteria.push({ key: "precision", label: "Precisão", score: clamp(s), notes });
  }
  /* Completude */
  {
    const s = (detected.length / SECTION_ORDER.length) * 100;
    criteria.push({ key: "completeness", label: "Completude", score: clamp(s), notes: [`${detected.length}/10 secções presentes.`, ...(missing.length ? [`Em falta: ${missing.map((m) => SECTION_LABELS[m]).join(", ")}.`] : [])] });
  }
  /* Estrutura */
  {
    const notes: string[] = [];
    let s = 25;
    if (headings >= 3) { s += 35; notes.push(`${headings} secções/títulos.`); } else if (headings) { s += 15; notes.push("Poucos títulos de secção."); } else notes.push("Sem títulos de secção.");
    if (bullets >= 3) { s += 25; notes.push("Usa listas."); }
    if (lines >= 5) s += 15;
    criteria.push({ key: "structure", label: "Estrutura", score: clamp(s), notes });
  }
  /* Ausência de ambiguidades */
  {
    const notes: string[] = [];
    let s = 90 - vague.length * 7 - pron.length * 5;
    if (/\b(breve|curto|short)\b/.test(norm) && /\b(detalhad|exaustiv|detailed|completo)\b/.test(norm)) { s -= 20; notes.push("Instruções possivelmente contraditórias (curto vs. detalhado)."); }
    if (pron.length) notes.push(`Referências pouco claras: ${pron.join(", ")}.`);
    if ((raw.match(/\?/g) ?? []).length > 3) { s -= 10; notes.push("Muitas perguntas em aberto dentro do prompt."); }
    if (!notes.length && !vague.length) notes.push("Sem ambiguidades evidentes.");
    criteria.push({ key: "ambiguity", label: "Ausência de ambiguidades", score: clamp(s), notes });
  }
  /* Critérios de sucesso */
  {
    const notes: string[] = [];
    let s = 15;
    if (detected.includes("qualityCriteria")) { s += 40; notes.push("Critérios de qualidade definidos."); } else notes.push("Sem critérios de sucesso explícitos.");
    if (detected.includes("validation")) { s += 30; notes.push("Inclui verificação/validação."); }
    if (precisionHits) s += 15;
    criteria.push({ key: "success", label: "Critérios de sucesso", score: clamp(s), notes });
  }

  const overall = clamp(criteria.reduce((n, c) => n + c.score, 0) / criteria.length);
  const suggestions: string[] = [];
  const by = Object.fromEntries(criteria.map((c) => [c.key, c.score]));
  if (missing.includes("role")) suggestions.push("Define o papel que a IA deve assumir (ex.: 'Assume o papel de engenheiro de software sénior').");
  if (missing.includes("context")) suggestions.push("Acrescenta contexto: projeto, público-alvo e situação atual.");
  if (missing.includes("objective")) suggestions.push("Escreve o objetivo numa frase com um resultado verificável.");
  if (missing.includes("constraints")) suggestions.push("Indica limites: o que não deve ser feito, tecnologias proibidas, extensão máxima.");
  if (missing.includes("expectedOutput")) suggestions.push("Especifica o formato da resposta (secções, tabela, JSON, extensão).");
  if (missing.includes("qualityCriteria") || by.success < 50) suggestions.push("Define critérios de sucesso mensuráveis (ex.: 'todos os testes passam', 'máximo 150 palavras').");
  if (missing.includes("validation")) suggestions.push("Pede ao modelo que reveja o resultado contra os requisitos antes de entregar.");
  if (missing.includes("workflow")) suggestions.push("Descreve os passos pela ordem em que devem ser executados.");
  if (vague.length) suggestions.push(`Substitui termos vagos (${vague.slice(0, 4).join(", ")}) por descrições concretas.`);
  if (by.structure < 50) suggestions.push("Organiza o prompt em secções com títulos e listas.");
  if (by.precision < 50) suggestions.push("Acrescenta números concretos: quantidades, limites, prazos ou formatos.");

  return { criteria, overall, suggestions, detectedSections: detected.map((k) => SECTION_LABELS[k]), missingSections: missing.map((k) => SECTION_LABELS[k]) };
}

/** Gera uma versão melhorada e estruturada, preservando o pedido original como contexto. */
export function improvePrompt(prompt: string, target: TargetModel, responseLanguage = "português de Portugal", category?: CategoryId): string {
  const interp = interpret(prompt, category);
  const spec = buildSpec(interp);
  return renderPrompt(spec, { target, detail: "standard", responseLanguage, sourceText: prompt });
}
