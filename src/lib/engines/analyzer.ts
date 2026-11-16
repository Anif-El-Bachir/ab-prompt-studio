import type { DimensionScore, IdeaAnalysis, Interpretation, RiskItem } from "../types";
import { getCategory } from "./categories";
import { clamp, countTerms, matchedTerms, normalize, uniq } from "../text";

/* MÓDULO A — IDEA INTELLIGENCE
 * Avaliação heurística e transparente. Cada pontuação mostra os sinais que a
 * originaram e se assenta em evidência (dito pelo utilizador), pressuposto ou desconhecido.
 */

const VAGUE = ["algo", "coisa", "coisas", "etc", "tipo", "qualquer", "varias", "muitas", "tudo", "something", "stuff", "things", "whatever", "revolucionario", "o melhor", "unico no mundo"];
const HARD_TECH = ["blockchain", "cripto", "nft", "realidade aumentada", "realidade virtual", "vr","hardware", "iot", "drone", "robo fisico", "treinar modelo", "modelo proprio", "tempo real", "real-time", "video ao vivo", "streaming", "reconhecimento facial", "carro autonomo", "100% preciso", "garantido", "sem erros"];
const COMPLEX = ["pagamentos", "pagamento", "payments", "marketplace", "multi-tenant", "multiempresa", "tempo real", "real-time", "chat", "notificacoes", "geolocalizacao", "mapa", "mapas", "integracao", "integracoes", "api", "ia", "ai", "inteligencia artificial", "machine learning", "relatorios", "dashboard", "permissoes", "multilingue", "offline", "sincronizacao", "subscricoes", "faturacao", "agendamento", "reservas", "video", "upload", "pesquisa avancada", "multiagente", "agentes"];
const SCALABLE = ["saas", "subscricao", "subscricoes", "assinatura", "online", "digital", "plataforma", "app", "automacao", "automatizar", "marketplace", "api", "self-service", "recorrente", "template", "curso online", "ebook"];
const NON_SCALABLE = ["presencial", "manual", "consultoria", "artesanal", "a medida", "por medida", "local fisico", "loja fisica", "porta a porta", "personalizado para cada"];
const MONETIZATION = ["vender", "venda", "preco", "subscricao", "assinatura", "mensalidade", "comissao", "anuncios", "publicidade", "freemium", "pagar", "receita", "lucro", "monetizar", "faturar", "cobrar"];
const PROBLEM = ["problema", "dificuldade", "dor", "perder", "perdem", "demora", "caro", "ineficiente", "falta de", "nao existe", "frustracao", "pain", "problem", "struggle"];
const REGULATED = ["saude", "medico", "clinica", "paciente", "financeiro", "banco", "investimento", "trading", "seguros", "menores", "criancas", "dados pessoais", "rgpd", "gdpr", "juridico", "advocacia", "farmacia", "apostas"];

function dim(key: string, label: string, score: number, basis: DimensionScore["basis"], rationale: string[], inverted = false): DimensionScore {
  return { key, label, score: clamp(score), basis, rationale, inverted };
}

/** Custo indicativo (EUR) por nível de complexidade, para comparar com o orçamento declarado. */
function costRange(complexity: number): [number, number] {
  if (complexity < 30) return [500, 3000];
  if (complexity < 55) return [3000, 15000];
  if (complexity < 75) return [15000, 60000];
  return [60000, 200000];
}

export function analyzeIdea(interp: Interpretation): IdeaAnalysis {
  const norm = normalize(interp.raw);
  const profile = getCategory(interp.category);
  const evidence: string[] = [];
  const assumptions: string[] = [];
  const unknowns: string[] = [];

  evidence.push(`Categoria identificada: ${profile.label}${interp.categoryConfidence < 0.34 ? " (confiança baixa)" : ""}.`);
  if (interp.audience) evidence.push(`Público indicado: ${interp.audience}.`); else unknowns.push("Público-alvo não definido.");
  if (interp.budget) evidence.push(`Orçamento indicado: ${interp.budget.text}.`); else unknowns.push("Orçamento disponível.");
  if (interp.deadline) evidence.push(`Prazo indicado: ${interp.deadline.text} (~${interp.deadline.weeks} semanas).`); else unknowns.push("Prazo ou data-limite.");
  if (interp.platforms.length) evidence.push(`Plataformas mencionadas: ${interp.platforms.join(", ")}.`);
  if (interp.technologies.length) evidence.push(`Tecnologias mencionadas: ${interp.technologies.join(", ")}.`);
  if (interp.features.length) evidence.push(`${interp.features.length} funcionalidade(s) ou requisito(s) descritos.`);

  /* Clareza */
  const vague = matchedTerms(norm, VAGUE);
  const clarityNotes: string[] = [];
  let clarity = 25;
  if (interp.wordCount >= 25) { clarity += 15; clarityNotes.push("Descrição com extensão suficiente."); } else clarityNotes.push("Descrição curta: pouco contexto.");
  if (interp.wordCount >= 80) clarity += 10;
  if (interp.audience) { clarity += 12; clarityNotes.push("Público definido."); }
  if (interp.features.length >= 2) { clarity += 12; clarityNotes.push("Funcionalidades/requisitos concretos."); }
  if (interp.constraints.length) { clarity += 8; clarityNotes.push("Restrições explícitas."); }
  if (interp.deadline || interp.budget) clarity += 8;
  if (interp.categoryConfidence >= 0.5) clarity += 10;
  if (vague.length) { clarity -= vague.length * 5; clarityNotes.push(`Termos vagos: ${vague.join(", ")}.`); }

  /* Complexidade (alto = mais complexo) */
  const complexHits = matchedTerms(norm, COMPLEX);
  let complexity = 20 + complexHits.length * 7 + Math.max(0, interp.features.length - 2) * 4 + Math.max(0, interp.platforms.length - 1) * 6;
  if (["multiagent", "agent"].includes(interp.category)) complexity += 15;
  if (["content", "marketing", "organization"].includes(interp.category)) complexity -= 10;
  complexity = clamp(complexity);
  const complexityNotes = [
    complexHits.length ? `Componentes exigentes: ${complexHits.slice(0, 8).join(", ")}.` : "Sem componentes técnicos exigentes identificados.",
    `${interp.features.length} funcionalidade(s) e ${interp.platforms.length} plataforma(s) referidas.`,
  ];

  /* Viabilidade técnica */
  const hard = matchedTerms(norm, HARD_TECH);
  let tech = 82 - hard.length * 10 - Math.max(0, complexity - 60) * 0.5;
  const techNotes: string[] = [];
  if (hard.length) techNotes.push(`Elementos tecnicamente difíceis ou promessas absolutas: ${hard.join(", ")}.`);
  else techNotes.push("Não foram identificadas exigências tecnológicas fora do comum.");
  if (interp.technologies.length) { tech += 5; techNotes.push("Tecnologias conhecidas e maduras referidas."); }
  assumptions.push("A viabilidade técnica assume uso de tecnologias e serviços existentes, sem investigação de raiz.");

  /* Estimativa de tempo */
  const baseWeeks = complexity < 30 ? [1, 3] : complexity < 55 ? [4, 10] : complexity < 75 ? [10, 24] : [24, 52];
  const estimatedTime = {
    minWeeks: baseWeeks[0],
    maxWeeks: baseWeeks[1],
    assumptions: ["Uma pessoa ou equipa pequena com experiência na stack.", "Âmbito de MVP (primeira versão utilizável), não produto final.", "Estimativa por nível de complexidade, não por planeamento detalhado."],
  };

  /* Prazo */
  let timeline: DimensionScore;
  if (interp.deadline) {
    const ratio = interp.deadline.weeks / ((baseWeeks[0] + baseWeeks[1]) / 2);
    timeline = dim("timeline", "Adequação do prazo", ratio >= 1.2 ? 85 : ratio >= 0.8 ? 65 : ratio >= 0.5 ? 40 : 20, "evidence", [`Prazo indicado ~${interp.deadline.weeks} semanas vs. estimativa ${baseWeeks[0]}–${baseWeeks[1]} semanas.`]);
  } else {
    timeline = dim("timeline", "Adequação do prazo", 50, "unknown", ["Sem prazo indicado: valor neutro, não é uma avaliação."]);
  }

  /* Viabilidade financeira */
  const [cMin, cMax] = costRange(complexity);
  let financial: DimensionScore;
  if (interp.budget) {
    const amountEur = interp.budget.currency === "EUR" ? interp.budget.amount : interp.budget.currency === "USD" ? interp.budget.amount * 0.92 : interp.budget.currency === "BRL" ? interp.budget.amount * 0.17 : interp.budget.amount * 0.001;
    const r = amountEur / ((cMin + cMax) / 2);
    financial = dim("financial", "Viabilidade financeira", r >= 1.5 ? 85 : r >= 0.8 ? 70 : r >= 0.4 ? 45 : 25, "evidence", [`Orçamento ${interp.budget.text} vs. custo indicativo ${cMin.toLocaleString("pt-PT")}–${cMax.toLocaleString("pt-PT")} € (desenvolvimento subcontratado).`, "Desenvolvimento próprio reduz custo monetário mas aumenta o tempo."]);
    assumptions.push("O custo indicativo usa intervalos genéricos de mercado para desenvolvimento subcontratado; não é um orçamento.");
  } else {
    financial = dim("financial", "Viabilidade financeira", 50, "unknown", [`Sem orçamento indicado. Referência indicativa para este nível de complexidade: ${cMin.toLocaleString("pt-PT")}–${cMax.toLocaleString("pt-PT")} €.`]);
  }

  /* Recursos */
  const resources = uniq([
    ...(["software", "app", "website", "agent", "multiagent", "automation"].includes(interp.category) ? ["Developer full-stack"] : []),
    ...(["website", "app", "marketing"].includes(interp.category) || complexity > 50 ? ["Designer UX/UI"] : []),
    ...(["agent", "multiagent"].includes(interp.category) || countTerms(norm, ["ia", "ai", "llm", "inteligencia artificial"]) ? ["Especialista em IA / prompts", "Orçamento para chamadas de API de IA"] : []),
    ...(["business", "marketing"].includes(interp.category) ? ["Responsável de marketing/vendas"] : []),
    ...(interp.category === "data" ? ["Analista de dados", "Acesso aos dados de origem"] : []),
    ...(interp.category === "security" ? ["Engenheiro de segurança", "Autorização formal sobre os sistemas"] : []),
    ...(interp.category === "content" ? ["Criador de conteúdo / editor"] : []),
    ...(countTerms(norm, REGULATED) ? ["Aconselhamento jurídico / conformidade"] : []),
    "Alojamento e domínio",
    ...(complexity > 60 ? ["Gestor de projeto", "QA / testes"] : []),
  ]);
  const resourceScore = dim("resources", "Exigência de recursos", 15 + resources.length * 8 + complexity * 0.3, "assumption", [`${resources.length} tipo(s) de recurso necessários.`], true);

  /* Escalabilidade */
  const sc = matchedTerms(norm, SCALABLE);
  const nsc = matchedTerms(norm, NON_SCALABLE);
  const scal = dim("scalability", "Escalabilidade", 50 + sc.length * 8 - nsc.length * 15, sc.length || nsc.length ? "evidence" : "assumption", [
    sc.length ? `Sinais de escala: ${sc.join(", ")}.` : "Sem sinais claros de modelo escalável.",
    ...(nsc.length ? [`Sinais de dependência de trabalho manual/local: ${nsc.join(", ")}.`] : []),
  ]);

  /* Potencial de mercado (indicativo) */
  const mon = matchedTerms(norm, MONETIZATION);
  const prob = matchedTerms(norm, PROBLEM);
  const market = dim("market", "Potencial de mercado (indicativo)", 35 + (interp.audience ? 15 : 0) + mon.length * 6 + prob.length * 8, mon.length || prob.length || interp.audience ? "assumption" : "unknown", [
    prob.length ? "Problema concreto descrito." : "O problema que resolve não está explícito.",
    mon.length ? `Modelo de receita mencionado (${mon.slice(0, 4).join(", ")}).` : "Sem modelo de receita mencionado.",
    "Sem dados de mercado reais: requer validação com potenciais clientes.",
  ]);
  if (!mon.length && ["business", "software", "app", "website"].includes(interp.category)) unknowns.push("Modelo de receita.");
  if (!prob.length) unknowns.push("Problema concreto e evidência de que existe procura.");

  /* Riscos */
  const risks: RiskItem[] = [];
  if (countTerms(norm, ["pagamento", "pagamentos", "payments", "cartao", "mb way", "stripe"])) risks.push({ text: "Processamento de pagamentos e conformidade PCI-DSS.", severity: "high", mitigation: "Usar um fornecedor certificado (ex.: Stripe) e nunca guardar dados de cartão." });
  if (countTerms(norm, REGULATED)) risks.push({ text: "Setor regulado ou dados sensíveis (RGPD e regulamentação específica).", severity: "high", mitigation: "Mapear obrigações legais antes de desenvolver; minimizar dados recolhidos; consultar jurista." });
  if (countTerms(norm, ["ia", "ai", "llm", "inteligencia artificial", "gpt", "claude", "gemini", "agente", "agentes"])) risks.push({ text: "Respostas incorretas da IA, custos variáveis por utilização e dependência de fornecedor.", severity: "medium", mitigation: "Validação humana em decisões críticas, limites de custo e camada de abstração de fornecedor." });
  if (countTerms(norm, ["marketplace"])) risks.push({ text: "Problema do ovo e da galinha (oferta vs. procura) em marketplaces.", severity: "high", mitigation: "Começar num nicho geográfico ou vertical e angariar oferta manualmente." });
  if (interp.platforms.some((p) => ["iOS", "Android"].includes(p))) risks.push({ text: "Revisão e políticas das lojas de aplicações (App Store / Google Play).", severity: "medium", mitigation: "Começar com PWA e publicar nativo depois de validar." });
  if (countTerms(norm, ["trading", "investimento", "lucro garantido", "rendimento"])) risks.push({ text: "Risco financeiro para utilizadores e regulação de serviços financeiros.", severity: "high", mitigation: "Não prometer rendimentos; testar em conta demo; verificar enquadramento legal." });
  if (hard.length) risks.push({ text: `Componentes tecnicamente exigentes (${hard.slice(0, 3).join(", ")}).`, severity: "medium", mitigation: "Prova de conceito técnica antes de comprometer prazo e orçamento." });
  if (complexity >= 65) risks.push({ text: "Âmbito grande para uma primeira versão.", severity: "medium", mitigation: "Reduzir o MVP às 3 funcionalidades que validam a proposta de valor." });
  if (!interp.audience) risks.push({ text: "Público-alvo indefinido: risco de construir algo que ninguém pede.", severity: "medium", mitigation: "Entrevistar 5–10 potenciais utilizadores antes de construir." });
  if (vague.length >= 2) risks.push({ text: "Objetivo vago, sujeito a interpretações diferentes.", severity: "low", mitigation: "Reescrever o objetivo com resultado mensurável." });
  if (countTerms(norm, ["scraping", "extrair dados de", "copiar conteudo"])) risks.push({ text: "Recolha de dados de terceiros pode violar termos de serviço ou direitos de autor.", severity: "medium", mitigation: "Usar APIs oficiais ou dados com licença adequada." });

  /* Oportunidades */
  const opportunities = uniq([
    ...(sc.length ? ["Modelo digital com custo marginal baixo por cliente adicional."] : []),
    ...(countTerms(norm, ["automacao", "automatizar", "ia", "ai"]) ? ["Redução de trabalho manual repetitivo — benefício fácil de medir (horas poupadas)."] : []),
    ...(interp.audience ? [`Nicho definido (${interp.audience}) permite marketing direcionado e mensagem específica.`] : []),
    ...(countTerms(norm, ["subscricao", "assinatura", "mensalidade", "recorrente"]) ? ["Receita recorrente previsível."] : []),
    ...(countTerms(norm, ["portugal", "lusofonia", "brasil", "angola", "pt"]) ? ["Mercado lusófono com menos concorrência em ferramentas localizadas."] : []),
    ...(interp.category === "content" || interp.category === "marketing" ? ["Conteúdo reutilizável em vários canais."] : []),
    "Validar rapidamente com um MVP de âmbito reduzido antes de investir mais.",
  ]);

  /* Obstáculos */
  const obstacles = uniq([
    ...(!interp.budget ? ["Orçamento desconhecido limita o planeamento."] : []),
    ...(!interp.deadline ? ["Sem prazo, o âmbito tende a crescer."] : []),
    ...(complexity > 55 ? ["Integrações múltiplas aumentam o tempo de testes e manutenção."] : []),
    ...(countTerms(norm, ["clientes", "utilizadores", "marketplace", "rede social", "comunidade"]) ? ["Aquisição dos primeiros utilizadores."] : []),
    ...(countTerms(norm, REGULATED) ? ["Requisitos legais podem atrasar o lançamento."] : []),
  ]);

  /* Alternativas */
  const alternatives = uniq([
    ...(complexity >= 55 ? ["Lançar uma versão reduzida (1–3 funcionalidades) e medir uso antes de expandir."] : []),
    ...(["website", "automation", "business"].includes(interp.category) ? ["Validar com ferramentas no-code (ex.: Webflow, Tally, n8n) antes de desenvolver à medida."] : []),
    ...(interp.platforms.some((p) => ["iOS", "Android", "Mobile"].includes(p)) ? ["PWA instalável em vez de apps nativas na primeira versão."] : []),
    ...(countTerms(norm, ["marketplace"]) ? ["Começar como serviço intermediado manualmente (concierge MVP)."] : []),
    ...(["agent", "multiagent"].includes(interp.category) ? ["Começar com um único agente com ferramentas bem definidas antes de um sistema multiagente."] : []),
    ...(countTerms(norm, ["treinar modelo", "modelo proprio"]) ? ["Usar um modelo existente via API com RAG em vez de treinar um modelo próprio."] : []),
    "Testar a procura com uma landing page e lista de espera antes de construir.",
  ]);

  assumptions.push("As pontuações resultam de regras heurísticas sobre o texto fornecido; mais detalhe produz avaliações mais fundamentadas.");

  const dimensions: DimensionScore[] = [
    dim("clarity", "Clareza do objetivo", clarity, "evidence", clarityNotes),
    dim("technical", "Viabilidade técnica", tech, hard.length ? "evidence" : "assumption", techNotes),
    financial,
    dim("complexity", "Complexidade de implementação", complexity, "evidence", complexityNotes, true),
    resourceScore,
    timeline,
    scal,
    market,
  ];

  return {
    dimensions,
    estimatedTime,
    resources,
    opportunities,
    risks,
    obstacles,
    alternatives,
    knowledge: { evidence, assumptions: uniq(assumptions), unknowns: uniq(unknowns) },
    disclaimer:
      "As pontuações (0–100) são indicadores heurísticos da informação fornecida, não probabilidades de sucesso. Valores marcados como 'desconhecido' são neutros e não representam avaliação.",
  };
}
