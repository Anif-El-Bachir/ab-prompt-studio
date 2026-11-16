import type { ArchComponent, ArchDependency, ArchLayer, Architecture, Interpretation } from "../types";
import { containsTerm, countTerms, normalize, uniq } from "../text";

/* MÓDULO C — SYSTEM ARCHITECT: transforma a interpretação numa arquitetura técnica. */

type Kind = "website" | "webapp" | "mobile" | "api" | "agent" | "multiagent" | "automation" | "data" | "operational";

const KIND_LABEL: Record<Kind, string> = {
  website: "Website",
  webapp: "Aplicação web",
  mobile: "Aplicação mobile / PWA",
  api: "Serviço / API",
  agent: "Agente de IA",
  multiagent: "Sistema multiagente",
  automation: "Automação",
  data: "Pipeline de dados",
  operational: "Estrutura operacional",
};

const ENTITY_DICT: [string[], string, string[]][] = [
  [["cliente", "clientes", "customer"], "Customer", ["id", "name", "email", "phone", "createdAt"]],
  [["produto", "produtos", "product", "catalogo"], "Product", ["id", "name", "description", "price", "stock", "createdAt"]],
  [["encomenda", "encomendas", "pedido", "pedidos", "order", "orders", "compra"], "Order", ["id", "customerId", "status", "total", "createdAt"]],
  [["pagamento", "pagamentos", "payment", "faturacao"], "Payment", ["id", "orderId", "provider", "status", "amount", "createdAt"]],
  [["fatura", "faturas", "invoice"], "Invoice", ["id", "customerId", "number", "total", "issuedAt"]],
  [["reserva", "reservas", "marcacao", "marcacoes", "agendamento", "booking"], "Booking", ["id", "userId", "resourceId", "startsAt", "endsAt", "status"]],
  [["mensagem", "mensagens", "chat", "message"], "Message", ["id", "conversationId", "senderId", "content", "createdAt"]],
  [["tarefa", "tarefas", "task", "todo"], "Task", ["id", "title", "status", "assigneeId", "dueAt"]],
  [["projeto", "projetos", "project"], "Project", ["id", "name", "ownerId", "status", "createdAt"]],
  [["documento", "documentos", "ficheiro", "ficheiros", "document", "upload"], "Document", ["id", "ownerId", "name", "mimeType", "url", "createdAt"]],
  [["evento", "eventos", "event"], "Event", ["id", "title", "startsAt", "location"]],
  [["curso", "cursos", "aula", "aulas", "course"], "Course", ["id", "title", "description", "price"]],
  [["artigo", "artigos", "post", "posts", "blog"], "Post", ["id", "title", "slug", "body", "publishedAt"]],
  [["notificacao", "notificacoes", "alerta", "alertas"], "Notification", ["id", "userId", "type", "payload", "readAt"]],
  [["subscricao", "assinatura", "plano", "planos", "subscription"], "Subscription", ["id", "userId", "plan", "status", "renewsAt"]],
  [["avaliacao", "avaliacoes", "review"], "Review", ["id", "authorId", "targetId", "rating", "comment"]],
  [["prompt", "prompts"], "Prompt", ["id", "title", "content", "version", "createdAt"]],
  [["agente", "agentes", "agent"], "AgentRun", ["id", "agentName", "status", "input", "output", "startedAt"]],
  [["relatorio", "relatorios", "report"], "Report", ["id", "type", "period", "data", "generatedAt"]],
];

function detectKind(interp: Interpretation, norm: string): Kind {
  switch (interp.category) {
    case "multiagent": return "multiagent";
    case "agent": return "agent";
    case "automation": return "automation";
    case "data": return "data";
    case "website": return countTerms(norm, ["login", "conta", "registo", "painel", "dashboard", "loja online", "e-commerce"]) ? "webapp" : "website";
    case "app": return interp.platforms.some((p) => ["iOS", "Android", "Mobile"].includes(p)) ? "mobile" : "webapp";
    case "software": return countTerms(norm, ["api", "backend", "servico", "microservicos"]) && !countTerms(norm, ["interface", "ecra", "dashboard", "frontend"]) ? "api" : "webapp";
    case "security": return "operational";
    default: return countTerms(norm, ["app", "plataforma", "site", "sistema", "software"]) ? "webapp" : "operational";
  }
}

function pickStack(interp: Interpretation) {
  const t = interp.technologies.map((x) => x.toLowerCase());
  const has = (...xs: string[]) => xs.some((x) => t.includes(x));
  const frontend = has("vue", "nuxt") ? "Vue / Nuxt" : has("angular") ? "Angular" : has("svelte") ? "SvelteKit" : has("flutter") ? "Flutter" : has("react native") ? "React Native" : "Next.js + React + TypeScript";
  const backend = has("django") ? "Django (Python)" : has("fastapi", "flask", "python") ? "FastAPI (Python)" : has("laravel", "php") ? "Laravel (PHP)" : has("spring", "java") ? "Spring Boot (Java)" : has(".net", "c#") ? "ASP.NET Core" : has("go") ? "Go" : has("nestjs") ? "NestJS" : "Next.js Route Handlers / Node.js";
  const db = has("mongodb") ? "MongoDB" : has("mysql") ? "MySQL" : has("supabase") ? "Supabase (PostgreSQL)" : has("firebase") ? "Firebase Firestore" : has("sqlite") ? "SQLite" : "PostgreSQL";
  return { frontend, backend, db };
}

function c(id: string, name: string, tech: string, description: string): ArchComponent {
  return { id, name, tech, description };
}

export function designSystem(interp: Interpretation): Architecture {
  const norm = normalize(interp.raw);
  const kind = detectKind(interp, norm);
  const stack = pickStack(interp);
  const needsAuth = kind !== "website" && kind !== "operational" || countTerms(norm, ["login", "conta", "contas", "registo", "utilizadores", "users"]) > 0;
  const needsPayments = countTerms(norm, ["pagamento", "pagamentos", "payments", "stripe", "subscricao", "assinatura", "checkout", "mb way"]) > 0;
  const needsAI = ["agent", "multiagent"].includes(kind) || countTerms(norm, ["ia", "ai", "llm", "gpt", "claude", "gemini", "inteligencia artificial", "chatbot"]) > 0;
  const needsEmail = countTerms(norm, ["email", "notificacao", "notificacoes", "newsletter"]) > 0;
  const needsFiles = countTerms(norm, ["upload", "ficheiro", "ficheiros", "documento", "documentos", "imagens", "fotos"]) > 0;
  const needsRealtime = countTerms(norm, ["tempo real", "real-time", "chat", "ao vivo"]) > 0;
  const messaging = interp.platforms.filter((p) => ["WhatsApp", "Telegram", "Slack", "Discord", "Email"].includes(p));

  /* Entidades */
  const entities: { name: string; fields: string[] }[] = [];
  if (needsAuth) entities.push({ name: "User", fields: ["id", "email", "name", "role", "passwordHash | authProviderId", "createdAt"] });
  for (const [terms, name, fields] of ENTITY_DICT) if (terms.some((x) => containsTerm(norm, x))) entities.push({ name, fields });
  if (needsPayments && !entities.some((e) => e.name === "Payment")) entities.push({ name: "Payment", fields: ["id", "userId", "provider", "status", "amount", "createdAt"] });
  if (needsAI && !entities.some((e) => e.name === "AgentRun")) entities.push({ name: "AiRequest", fields: ["id", "userId", "provider", "model", "tokens", "status", "createdAt"] });
  entities.push({ name: "AuditLog", fields: ["id", "actorId", "action", "target", "createdAt"] });
  const uniqueEntities = entities.filter((e, i) => entities.findIndex((x) => x.name === e.name) === i);

  /* Camadas e componentes */
  const layers: ArchLayer[] = [];
  const deps: ArchDependency[] = [];
  const clientComps: ArchComponent[] = [];
  if (kind === "website") clientComps.push(c("ui", "Website", stack.frontend.includes("Next") ? "Next.js (SSG) + Tailwind" : stack.frontend, "Páginas estáticas otimizadas para SEO e desempenho."));
  else if (kind === "mobile") clientComps.push(c("ui", "App mobile", stack.frontend.includes("Flutter") || stack.frontend.includes("Native") ? stack.frontend : "PWA (Next.js) → React Native/Expo depois", "Interface do utilizador em telemóvel."));
  else if (["webapp", "agent", "multiagent", "data"].includes(kind)) clientComps.push(c("ui", kind === "data" ? "Dashboard" : "Aplicação web", stack.frontend, "Interface, estado local e validação de formulários."));
  if (messaging.length) clientComps.push(c("channels", "Canais", messaging.join(" / "), "Pontos de contacto do utilizador fora da app."));
  if (clientComps.length) layers.push({ id: "client", name: "Cliente", components: clientComps });

  const apiComps: ArchComponent[] = [];
  if (kind !== "website" && kind !== "operational") apiComps.push(c("api", "API", stack.backend, "Endpoints REST, validação (schemas) e controlo de acesso."));
  if (kind === "website" && countTerms(norm, ["formulario", "contacto", "newsletter"])) apiComps.push(c("api", "Funções servidor", "Route handlers / serverless", "Formulário de contacto e integrações."));
  if (needsAuth) apiComps.push(c("auth", "Autenticação", "Auth.js / Supabase Auth / OAuth 2.0", "Sessões, papéis e permissões."));
  if (apiComps.length) layers.push({ id: "api", name: "API e acesso", components: apiComps });

  const svc: ArchComponent[] = [];
  if (kind === "agent") {
    svc.push(c("agent", "Agente", "Ciclo raciocínio → ferramenta → observação", "Decide os passos e chama ferramentas dentro dos limites."));
    svc.push(c("tools", "Ferramentas", "Function calling / MCP", "Ações expostas ao agente com validação de entradas."));
    svc.push(c("guard", "Salvaguardas", "Política de aprovação + filtros", "Aprovação humana e bloqueio de ações sensíveis."));
  }
  if (kind === "multiagent") {
    svc.push(c("orch", "Orquestrador", "Grafo de tarefas / fila", "Distribui trabalho, junta resultados e aplica critérios de paragem."));
    svc.push(c("agents", "Agentes especializados", "Papéis independentes", "Cada agente com objetivo, ferramentas e limites próprios."));
    svc.push(c("bus", "Barramento de mensagens", "Fila / eventos", "Comunicação assíncrona e rasto auditável."));
    svc.push(c("guard", "Salvaguardas", "Aprovação humana + limites de custo", "Bloqueia ações externas sem autorização."));
  }
  if (kind === "automation") {
    svc.push(c("trigger", "Gatilho", "Cron / webhook / evento", "Inicia o fluxo."));
    svc.push(c("flow", "Motor do fluxo", interp.technologies.find((x) => ["n8n", "zapier", "make.com"].includes(x)) ?? "Script Node.js/Python ou n8n", "Executa passos com repetições e idempotência."));
    svc.push(c("alerts", "Alertas", "Email / Telegram", "Notifica falhas e resultados."));
  }
  if (kind === "data") {
    svc.push(c("ingest", "Ingestão", "Python (pandas) / SQL", "Lê e valida as fontes de dados."));
    svc.push(c("transform", "Transformação", "dbt / pandas", "Limpeza, junções e métricas."));
  }
  if (["webapp", "mobile", "api"].includes(kind)) svc.push(c("domain", "Serviços de domínio", "Módulos por funcionalidade", "Regras de negócio isoladas da camada HTTP."));
  if (needsAI && !["agent", "multiagent"].includes(kind)) svc.push(c("ai", "Camada de IA", "Adaptador multi-fornecedor (servidor)", "Chamadas a modelos com chaves só no servidor."));
  if (needsRealtime) svc.push(c("rt", "Tempo real", "WebSockets / SSE", "Atualizações instantâneas."));
  if (needsEmail) svc.push(c("mail", "Notificações", "Resend / SES / SMTP", "Emails transacionais e alertas."));
  if (svc.length) layers.push({ id: "services", name: "Serviços", components: svc });

  const data: ArchComponent[] = [];
  if (kind !== "website" || countTerms(norm, ["blog", "cms"])) data.push(c("db", "Base de dados", kind === "website" ? "CMS headless / Markdown" : stack.db, "Persistência principal."));
  if (["agent", "multiagent"].includes(kind)) data.push(c("memory", "Memória", "Base vetorial / tabelas de contexto", "Memória de longo prazo e histórico."));
  if (needsFiles) data.push(c("storage", "Armazenamento de ficheiros", "S3 / Supabase Storage", "Ficheiros carregados pelos utilizadores."));
  if (["agent", "multiagent", "automation"].includes(kind)) data.push(c("logs", "Registos", "Logs estruturados", "Rasto de ações e decisões."));
  if (data.length) layers.push({ id: "data", name: "Dados", components: data });

  const ext: ArchComponent[] = [];
  if (needsPayments) ext.push(c("pay", "Pagamentos", "Stripe / MB WAY (via PSP)", "Checkout e webhooks de pagamento."));
  if (needsAI) ext.push(c("llm", "Fornecedores de IA", "Claude · OpenAI · Gemini · OpenRouter", "Acedidos apenas a partir do servidor."));
  for (const t of interp.technologies.filter((x) => ["notion", "google sheets", "excel", "shopify", "metatrader", "mql5"].includes(x))) ext.push(c(`ext-${t}`, t, "API externa", "Integração referida na ideia."));
  if (ext.length) layers.push({ id: "external", name: "Serviços externos", components: ext });

  if (kind === "operational") {
    layers.length = 0;
    layers.push(
      { id: "input", name: "Entrada", components: [c("intake", "Levantamento", "Inventário / entrevistas", "Recolha do estado atual e dos objetivos.")] },
      { id: "process", name: "Processo", components: [c("plan", "Plano", "Fases e responsáveis", "Sequência de ações priorizadas."), c("controls", "Controlos", "Checklists", "Verificações em cada etapa.")] },
      { id: "output", name: "Resultado", components: [c("deliver", "Entregáveis", "Documentos / sistema", "Resultado utilizável."), c("review", "Revisão contínua", "Rotina semanal/mensal", "Medição e melhoria.")] },
    );
  }

  /* Dependências: cada camada depende da seguinte (fluxo do pedido). */
  for (let i = 0; i < layers.length - 1; i++) {
    const a = layers[i], b = layers[i + 1];
    for (const ca of a.components) {
      const target = b.components[0];
      if (target) deps.push({ from: ca.id, to: target.id });
    }
  }
  const ids = new Set(layers.flatMap((l) => l.components.map((x) => x.id)));
  const link = (from: string, to: string, label?: string) => { if (ids.has(from) && ids.has(to) && !deps.some((d) => d.from === from && d.to === to)) deps.push({ from, to, label }); };
  link("api", "auth", "verifica sessão");
  link("domain", "db", "lê/escreve");
  link("ai", "llm", "chave no servidor");
  link("agent", "tools", "invoca");
  link("tools", "guard", "aprovação");
  link("agent", "llm", "raciocínio");
  link("agent", "memory", "contexto");
  link("orch", "agents", "distribui");
  link("agents", "bus", "mensagens");
  link("agents", "llm");
  link("bus", "logs", "rasto");
  link("flow", "alerts", "falhas");
  link("domain", "pay", "checkout");
  link("api", "storage", "uploads");
  link("ingest", "transform");
  link("transform", "db");

  /* APIs */
  const apis = kind === "website" || kind === "operational" ? [] : uniqueEntities
    .filter((e) => !["AuditLog", "User"].includes(e.name))
    .slice(0, 6)
    .flatMap((e) => {
      const base = `/api/${e.name.toLowerCase()}s`;
      return [
        { method: "GET", path: base, description: `Listar ${e.name} (paginação e filtros)` },
        { method: "POST", path: base, description: `Criar ${e.name} (validação de schema)` },
        { method: "PATCH", path: `${base}/:id`, description: `Atualizar ${e.name}` },
        { method: "DELETE", path: `${base}/:id`, description: `Remover ${e.name} (com confirmação)` },
      ];
    });
  if (needsAuth && kind !== "website") apis.unshift({ method: "POST", path: "/api/auth/session", description: "Iniciar/terminar sessão" });
  if (needsAI) apis.push({ method: "POST", path: "/api/ai/generate", description: "Pedido ao fornecedor de IA (chaves só no servidor)" });
  if (needsPayments) apis.push({ method: "POST", path: "/api/webhooks/payments", description: "Webhook do fornecedor de pagamentos (assinatura verificada)" });

  const agents =
    kind === "multiagent"
      ? [
          { name: "Orquestrador", responsibility: "Decompõe o objetivo, atribui tarefas e valida resultados." },
          { name: "Investigador", responsibility: "Recolhe e resume informação (fontes tratadas como dados)." },
          { name: "Executor", responsibility: "Realiza as tarefas com ferramentas aprovadas." },
          { name: "Revisor", responsibility: "Verifica qualidade e conformidade antes da entrega." },
        ]
      : kind === "agent"
        ? [{ name: "Agente principal", responsibility: interp.objective }]
        : needsAI
          ? [{ name: "Assistente IA", responsibility: "Funcionalidade de IA específica da aplicação, sem ações autónomas." }]
          : [];

  const security = uniq([
    "Validação de todas as entradas no servidor (schemas).",
    "Segredos em variáveis de ambiente; nunca no frontend.",
    "HTTPS e cabeçalhos de segurança (CSP, X-Frame-Options).",
    ...(needsAuth ? ["Controlo de acesso por papel em cada endpoint.", "Limitação de tentativas de login (rate limiting)."] : []),
    ...(needsPayments ? ["Verificação de assinatura nos webhooks de pagamento."] : []),
    ...(needsAI ? ["Conteúdo externo tratado como dados (proteção contra prompt injection).", "Limites de custo e de pedidos por utilizador para a IA."] : []),
    ...(needsFiles ? ["Validação de tipo e tamanho de ficheiros carregados."] : []),
    "Registos de auditoria de ações sensíveis.",
    "Cópias de segurança automáticas da base de dados.",
  ]);

  const integrations = uniq([
    ...ext.map((e) => `${e.name} — ${e.tech}`),
    ...(needsEmail ? ["Fornecedor de email transacional"] : []),
    ...messaging.map((m) => `${m} (API oficial)`),
  ]);

  const workflows = (() => {
    switch (kind) {
      case "agent": return ["Pedido do utilizador → agente planeia → chama ferramenta → observa → (aprovação humana se sensível) → resposta."];
      case "multiagent": return ["Objetivo → orquestrador decompõe → agentes executam em paralelo/sequência → revisor valida → entrega com rasto."];
      case "automation": return ["Gatilho → validação de dados → passos do fluxo → registo → alerta em caso de falha."];
      case "data": return ["Fonte → ingestão → limpeza → métricas → dashboard/relatório."];
      case "website": return ["Visitante → página → chamada à ação → formulário/contacto."];
      case "operational": return ["Levantamento → plano → execução por fases → verificação → revisão periódica."];
      default: return [
        "Utilizador → interface → API (autenticação + validação) → serviço de domínio → base de dados.",
        ...(needsPayments ? ["Checkout → fornecedor de pagamento → webhook → atualização da encomenda."] : []),
        ...(needsAI ? ["Pedido de IA → servidor → fornecedor escolhido → resposta validada → interface."] : []),
      ];
    }
  })();

  const folderStructure = folderTree(kind, stack.backend);

  const phases = [
    { name: "Fase 0 — Descoberta", goals: ["Confirmar objetivo, público e âmbito do MVP."], deliverables: ["Lista de requisitos priorizada", "Riscos e pressupostos"] },
    { name: "Fase 1 — Fundações", goals: ["Configurar projeto, design system, modelo de dados" + (needsAuth ? " e autenticação" : "") + "."], deliverables: ["Repositório", "Esquema de dados", "Ambiente de desenvolvimento"] },
    { name: "Fase 2 — Núcleo funcional", goals: ["Implementar os fluxos principais de ponta a ponta."], deliverables: ["Funcionalidades do MVP", "Testes da lógica principal"] },
    { name: "Fase 3 — Integrações", goals: [integrations.length ? `Ligar ${integrations.slice(0, 3).join(", ")}.` : "Integrações e polimento."], deliverables: ["Integrações testadas", "Tratamento de erros"] },
    { name: "Fase 4 — Qualidade e lançamento", goals: ["Testes, segurança, desempenho e publicação."], deliverables: ["Checklist de segurança", "Deploy", "Monitorização"] },
  ];

  return {
    kind,
    kindLabel: KIND_LABEL[kind],
    summary: `${KIND_LABEL[kind]} em ${layers.length} camadas (${layers.map((l) => l.name).join(" → ")}).`,
    layers,
    dependencies: deps,
    frontend: kind === "operational" ? [] : [stack.frontend, "Tailwind CSS", "Componentes reutilizáveis", "Validação de formulários (Zod)"],
    backend: kind === "website" || kind === "operational" ? [] : [stack.backend, "Validação com schemas", "Tratamento de erros centralizado", "Logs estruturados"],
    database: { engine: kind === "operational" ? "—" : stack.db, entities: kind === "operational" ? [] : uniqueEntities },
    apis,
    auth: needsAuth ? ["Email + palavra-passe com hash (argon2/bcrypt) ou OAuth (Google)", "Sessões com cookies httpOnly e secure", "Papéis: admin, utilizador"] : ["Não necessária para a primeira versão."],
    security,
    integrations,
    agents,
    workflows,
    folderStructure,
    phases,
  };
}

function folderTree(kind: Kind, backend: string): string {
  if (kind === "operational") {
    return ["projeto/", "├── 01-levantamento/", "├── 02-plano/", "├── 03-execucao/", "├── 04-controlos/", "└── 05-revisoes/"].join("\n");
  }
  if (kind === "automation") {
    return ["automacao/", "├── src/", "│   ├── triggers/", "│   ├── steps/", "│   ├── integrations/", "│   └── alerts/", "├── tests/", "├── .env.example", "└── README.md"].join("\n");
  }
  if (kind === "data") {
    return ["analise/", "├── data/raw/", "├── data/processed/", "├── notebooks/", "├── src/ingest/", "├── src/transform/", "├── reports/", "└── README.md"].join("\n");
  }
  const python = backend.includes("Python");
  const base = [
    "app/",
    "├── src/",
    "│   ├── app/            # rotas e páginas",
    "│   ├── components/     # UI reutilizável",
    "│   ├── lib/            # utilitários e clientes",
    "│   ├── features/       # módulos por funcionalidade",
  ];
  if (kind === "agent" || kind === "multiagent") base.push("│   ├── agents/         # definição de agentes", "│   ├── tools/          # ferramentas e permissões", "│   ├── orchestrator/   # coordenação" );
  base.push("│   └── server/         # API, serviços e acesso a dados");
  if (python) base.push("├── backend/", "│   ├── app/api/", "│   ├── app/services/", "│   └── app/models/");
  base.push("├── tests/", "├── public/", "├── .env.example", "└── README.md");
  return base.join("\n");
}
