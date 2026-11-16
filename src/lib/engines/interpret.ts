import type { Answers, CategoryId, ClarificationQuestion, Interpretation } from "../types";
import { CATEGORIES, getCategory } from "./categories";
import { cleanInput, detectInjection } from "./sanitize";
import { containsTerm, matchedTerms, normalize, sentences, truncate, uniq } from "../text";

/* FASE 2 — INTERPRETAÇÃO: extrai objetivo, contexto e sinais do texto livre. */

const INTENT = /\b(quero|queria|pretendo|preciso|gostava|gostaria|criar|desenvolver|construir|fazer|montar|lan[cç]ar|abrir|automatizar|analisar|organizar|escrever|i want|i need|build|create|make|develop|launch|help me|ajuda-me|ajudar)\b/i;

const PLATFORMS: [string, string][] = [
  ["web", "Web"], ["website", "Web"], ["browser", "Web"], ["pwa", "PWA"], ["mobile", "Mobile"], ["telemovel", "Mobile"],
  ["android", "Android"], ["ios", "iOS"], ["iphone", "iOS"], ["desktop", "Desktop"], ["windows", "Windows"], ["mac", "macOS"],
  ["whatsapp", "WhatsApp"], ["telegram", "Telegram"], ["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"],
  ["linkedin", "LinkedIn"], ["youtube", "YouTube"], ["email", "Email"], ["slack", "Slack"], ["discord", "Discord"],
];

const TECHNOLOGIES = [
  "react", "next.js", "nextjs", "vue", "nuxt", "angular", "svelte", "tailwind", "typescript", "javascript", "node", "express", "nestjs",
  "python", "django", "flask", "fastapi", "java", "spring", "kotlin", "swift", "flutter", "react native", "php", "laravel", "wordpress",
  "ruby", "rails", ".net", "c#", "go", "rust", "postgresql", "postgres", "mysql", "mongodb", "sqlite", "supabase", "firebase", "redis",
  "indexeddb", "docker", "kubernetes", "aws", "azure", "gcp", "vercel", "stripe", "paypal", "mb way", "openai", "claude", "gemini",
  "openrouter", "ollama", "langchain", "n8n", "zapier", "make.com", "notion", "obsidian", "excel", "google sheets", "power bi",
  "pandas", "sql", "graphql", "mql5", "metatrader", "shopify", "webflow", "figma", "mcp",
];

const TECH_LABEL: Record<string, string> = { nextjs: "next.js", postgres: "postgresql" };

const AUDIENCE_RE = /(?:p[uú]blico[- ]alvo|target audience|destinad[oa]s?\s+a|dirigid[oa]s?\s+a|focad[oa]s?\s+em|\bfor\b)\s*:?\s*([^.;\n]{3,80})/i;
const AUDIENCE_FOR_RE = /\bpara\s+((?:os|as|o|a)\s+)?((?:pequen[oa]s|médi[oa]s|clientes|utilizadores|usu[aá]rios|empresas|pme|estudantes|alunos|professores|equipas|restaurantes|lojas|cl[ií]nicas|profissionais|freelancers|fam[ií]lias|pais|criadores|developers|programadores|m[eé]dicos|advogados|imobili[aá]rias|gin[aá]sios|hot[eé]is|turistas|jovens|idosos|investidores|traders|comerciantes)[^.;,\n]{0,60})/i;

const BUDGET_RE = /(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(k|mil)?\s*(€|eur|euros|\$|usd|d[oó]lares|reais|r\$|kz|kwanzas)/i;
const BUDGET_PREFIX_RE = /(€|\$|r\$)\s*(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d+)?|\d+)\s*(k|mil)?/i;
const DEADLINE_RE = /(\d+)\s*(dias?|semanas?|meses|m[eê]s|anos?|days?|weeks?|months?|years?)/i;

const CONSTRAINT_RE = /\b(sem\s|n[aã]o\s+(pode|deve|quero|usar)|apenas|s[oó]\s|obrigat[oó]rio|tem de|tem que|limite|m[aá]ximo|m[ií]nimo|without|must not|only|no more than|at most|gr[aá]tis|gratuito|free)\b/i;
const FEATURE_RE = /\b(deve|dever[aá]|permitir|permita|ter\s|incluir|com\s+(um|uma|login|registo|pagamentos?|chat|painel)|should|must|allow|include|support|funcionalidade|feature)\b/i;

function detectCategory(norm: string): { category: CategoryId; confidence: number; scores: Partial<Record<CategoryId, number>> } {
  const scores: Partial<Record<CategoryId, number>> = {};
  for (const c of CATEGORIES) {
    let s = 0;
    for (const k of c.keywords) if (containsTerm(norm, k)) s += k.includes(" ") ? 2 : 1;
    if (s > 0) scores[c.id] = s;
  }
  // Ajustes: multiagente prevalece sobre agente; site/app prevalecem sobre software genérico.
  if (scores.multiagent && scores.agent) scores.multiagent += 2;
  const entries = Object.entries(scores) as [CategoryId, number][];
  if (entries.length === 0) return { category: "business", confidence: 0, scores };
  entries.sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((n, [, v]) => n + v, 0);
  return { category: entries[0][0], confidence: Math.min(1, entries[0][1] / Math.max(total, 3)), scores };
}

function parseAmount(raw: string, mult?: string): number {
  let n = raw.replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(n)) n = n.replace(/\./g, "").replace(",", ".");
  else n = n.replace(",", ".");
  let v = parseFloat(n);
  if (mult && /k|mil/i.test(mult)) v *= 1000;
  return v;
}

function currencyOf(sym: string): string {
  const s = sym.toLowerCase();
  if (s.includes("€") || s.startsWith("eur")) return "EUR";
  if (s.includes("r$") || s.startsWith("rea")) return "BRL";
  if (s.startsWith("kz") || s.startsWith("kwa")) return "AOA";
  return "USD";
}

function toWeeks(n: number, unit: string): number {
  const u = normalize(unit);
  if (u.startsWith("dia") || u.startsWith("day")) return Math.max(1, Math.round(n / 7));
  if (u.startsWith("sem") || u.startsWith("week")) return n;
  if (u.startsWith("mes") || u.startsWith("month")) return Math.round(n * 4.3);
  return Math.round(n * 52);
}

export function interpret(input: string, override?: CategoryId): Interpretation {
  const raw = cleanInput(input).trim();
  const norm = normalize(raw);
  // Frases com padrões de injeção nunca entram nas secções do prompt; ficam apenas no bloco delimitado como dados.
  const sents = sentences(raw).filter((s) => detectInjection(s).length === 0);
  const detected = detectCategory(norm);
  const category = override ?? detected.category;
  const profile = getCategory(category);

  const objectiveSentence = sents.find((s) => INTENT.test(s)) ?? sents[0] ?? raw;
  const objective = truncate(objectiveSentence.replace(/\s+/g, " ").trim(), 320);
  const contextSentences = sents.filter((s) => s !== objectiveSentence);
  const context = truncate(contextSentences.join(" "), 1200);

  const audMatch = raw.match(AUDIENCE_RE) ?? null;
  const audForMatch = raw.match(AUDIENCE_FOR_RE);
  const rawAudience = audForMatch ? audForMatch[2] : audMatch && !/^\s*(gerir|criar|fazer|que)\b/i.test(audMatch[1]) ? audMatch[1] : undefined;
  // Corta o público antes de verbos ("…clínicas em Portugal marcarem consultas" → "…clínicas em Portugal").
  const audience = rawAudience?.split(/\s+(?=(?:\p{L}+(?:arem|erem|irem)|que|poderem|para|com|a fim)(?![\p{L}]))/iu)[0].trim() || undefined;

  const platforms = uniq(PLATFORMS.filter(([k]) => containsTerm(norm, k)).map(([, v]) => v));
  const technologies = uniq(matchedTerms(norm, TECHNOLOGIES).map((t) => TECH_LABEL[t] ?? t));

  let budget: Interpretation["budget"];
  const b1 = raw.match(BUDGET_RE);
  const b2 = raw.match(BUDGET_PREFIX_RE);
  if (b1) budget = { amount: parseAmount(b1[1], b1[2]), currency: currencyOf(b1[3]), text: b1[0].trim() };
  else if (b2) budget = { amount: parseAmount(b2[2], b2[3]), currency: currencyOf(b2[1]), text: b2[0].trim() };

  let deadline: Interpretation["deadline"];
  const d = raw.match(DEADLINE_RE);
  if (d) deadline = { weeks: toWeeks(parseInt(d[1], 10), d[2]), text: d[0] };

  const constraints = uniq(sents.filter((s) => CONSTRAINT_RE.test(s)).map((s) => truncate(s, 200))).slice(0, 8);
  const bulletLines = raw.split(/\n/).map((l) => l.trim()).filter((l) => /^[-*•]|^\d+[.)]/.test(l) && detectInjection(l).length === 0).map((l) => l.replace(/^[-*•\d.)\s]+/, ""));
  const featureSents = sents.filter((s) => FEATURE_RE.test(s) && !constraints.includes(truncate(s, 200)));
  const features = uniq([...bulletLines, ...featureSents].map((s) => truncate(s, 200))).slice(0, 12);

  return {
    raw,
    category,
    categoryConfidence: override ? 1 : detected.confidence,
    categoryScores: detected.scores,
    objective,
    context,
    expectedOutput: profile.expectedOutput,
    audience,
    platforms,
    technologies,
    budget,
    deadline,
    constraints,
    features,
    wordCount: raw ? raw.split(/\s+/).length : 0,
    injectionWarnings: detectInjection(input),
  };
}

/* FASE 3 — CLARIFICAÇÃO: perguntas específicas sobre o que falta. */

export function clarify(interp: Interpretation): ClarificationQuestion[] {
  const norm = normalize(interp.raw);
  const profile = getCategory(interp.category);
  const qs: ClarificationQuestion[] = [];

  if (interp.wordCount < 12) {
    qs.push({ id: "detail", question: "Podes descrever a ideia com mais detalhe: o que é, para quem, e que resultado esperas?", why: "O texto é muito curto para uma interpretação fiável.", required: true });
  }
  if (interp.categoryConfidence < 0.34) {
    qs.push({
      id: "type",
      question: "Que tipo de resultado pretendes obter?",
      why: "A categoria do pedido não é clara; isto muda o papel, a estrutura e os critérios do prompt.",
      required: true,
      options: CATEGORIES.map((c) => c.label),
    });
  }
  for (const q of profile.questions) {
    if (q.id === "features" && interp.features.length >= 3) continue;
    if (q.id === "audience" && interp.audience) continue;
    if (q.id === "budget" && interp.budget) continue;
    if (q.id === "platform" && interp.platforms.length) continue;
    if (q.answeredBy.length && q.answeredBy.some((t) => containsTerm(norm, t))) continue;
    qs.push({ id: q.id, question: q.question, why: q.why, required: qs.length < 2, placeholder: q.placeholder, options: q.options });
  }
  if (!interp.deadline && ["software", "website", "app", "business", "automation", "multiagent", "agent"].includes(interp.category)) {
    qs.push({ id: "deadline", question: "Existe um prazo ou data-limite?", why: "Permite avaliar se o âmbito cabe no tempo disponível.", required: false, placeholder: "Ex.: 6 semanas" });
  }
  if (!interp.audience && !qs.some((q) => q.id === "audience" || q.id === "users" || q.id === "customer")) {
    qs.push({ id: "audience", question: "Quem vai beneficiar ou utilizar o resultado?", why: "O público define tom, profundidade e prioridades.", required: false });
  }
  return qs.slice(0, 6);
}

/** Incorpora respostas da clarificação na interpretação (reprocessa o texto enriquecido). */
export function applyAnswers(interp: Interpretation, answers: Answers, questions: ClarificationQuestion[]): Interpretation {
  const filled = questions.filter((q) => answers[q.id]?.trim());
  if (filled.length === 0) return interp;
  let override: CategoryId | undefined = interp.categoryConfidence === 1 ? interp.category : undefined;
  const typeAnswer = answers["type"];
  if (typeAnswer) {
    const c = CATEGORIES.find((x) => x.label === typeAnswer || normalize(x.label) === normalize(typeAnswer));
    if (c) override = c.id;
  }
  const extra = filled.map((q) => `${q.question} ${answers[q.id].trim()}.`).join("\n");
  const merged = interpret(`${interp.raw}\n\n${extra}`, override ?? interp.category);
  // Mantém objetivo original (as respostas enriquecem contexto, não substituem o objetivo).
  return {
    ...merged,
    raw: interp.raw,
    objective: interp.objective,
    context: [interp.context, ...filled.map((q) => `${q.question.replace(/\?$/, "")}: ${answers[q.id].trim()}`)].filter(Boolean).join("\n"),
    injectionWarnings: [...interp.injectionWarnings, ...detectInjection(extra)],
  };
}
