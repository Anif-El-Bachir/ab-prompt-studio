import "server-only";
import { AnthropicCallError, callAnthropic } from "./anthropic";

/* Camada de integração com fornecedores de IA — executa APENAS no servidor.
 * As chaves vêm de variáveis de ambiente e nunca são devolvidas ao cliente. */

export type ProviderId = "anthropic" | "openai" | "gemini" | "openrouter" | "custom";

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  configured: boolean;
  model: string;
}

export interface GenerateRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

export class ProviderError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

interface ProviderDef {
  label: string;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  call(req: GenerateRequest, model: string, key: string, signal: AbortSignal): Promise<string>;
}

async function readJson(res: Response, label: string): Promise<any> {
  if (!res.ok) {
    // Não propagar o corpo bruto (pode conter detalhes da conta); apenas o código.
    const hint =
      res.status === 401 || res.status === 403 ? "credenciais inválidas ou sem permissão"
      : res.status === 404 ? "modelo não encontrado ou indisponível para esta conta — muda o modelo no .env.local"
      : res.status === 429 ? "quota ou limite de pedidos excedido (os planos gratuitos têm limites diários por modelo)"
      : res.status >= 500 ? "erro do fornecedor" : "pedido rejeitado";
    throw new ProviderError(`${label}: ${hint} (HTTP ${res.status}).`, res.status === 429 ? 429 : 502);
  }
  return res.json();
}

/** Extrai o texto de uma resposta estilo OpenAI: aceita string ou lista de blocos {type:"text", text}. */
export function extractChatText(j: any): string {
  const content = j?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((p: any) => (typeof p === "string" ? p : p?.text ?? "")).join("").trim();
  return "";
}

/**
 * Fornecedores compatíveis com a API OpenAI. Quando a resposta vem vazia (comum em routers
 * de modelos gratuitos, que podem escolher um modelo que só devolve raciocínio), repete o pedido.
 */
function openAICompatible(url: string, label: string, extraHeaders: Record<string, string> = {}, emptyRetries = 0) {
  return async (req: GenerateRequest, model: string, key: string, signal: AbortSignal) => {
    for (let attempt = 0; attempt <= emptyRetries; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}), ...extraHeaders },
        body: JSON.stringify({ model, max_tokens: req.maxTokens ?? 4000, messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }] }),
      });
      const text = extractChatText(await readJson(res, label));
      if (text) return text;
    }
    throw new ProviderError(`${label}: o modelo devolveu uma resposta vazia${emptyRetries ? ` (${emptyRetries + 1} tentativas)` : ""}. Tenta outra vez ou escolhe outro fornecedor.`);
  };
}

const PROVIDERS: Record<ProviderId, ProviderDef> = {
  anthropic: {
    label: "Anthropic (Claude)",
    keyEnv: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_MODEL",
    defaultModel: "claude-opus-5-5",
    async call(req, model, key, signal) {
      try {
        // SDK oficial; max_tokens próprio (16 000) porque o Claude pensa antes de responder.
        return await callAnthropic({ system: req.system, user: req.user }, model, key, signal);
      } catch (e) {
        if (e instanceof AnthropicCallError) throw new ProviderError(e.message, e.status);
        throw e;
      }
    },
  },
  openai: {
    label: "OpenAI",
    keyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
    defaultModel: "gpt-4.1-mini",
    call: openAICompatible("https://api.openai.com/v1/chat/completions", "OpenAI"),
  },
  gemini: {
    label: "Google Gemini",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-3.5-flash",
    async call(req, model, key, signal) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.user }] }],
          generationConfig: { maxOutputTokens: req.maxTokens ?? 4000 },
        }),
      });
      const j = await readJson(res, "Gemini");
      const text = (j?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? "").join("");
      if (!text) throw new ProviderError("Gemini: resposta sem texto (pode ter sido bloqueada por filtros de segurança).");
      return text;
    },
  },
  openrouter: {
    label: "OpenRouter",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "openrouter/free",
    call: openAICompatible("https://openrouter.ai/api/v1/chat/completions", "OpenRouter", { "X-Title": "AB Prompt Studio" }, 2),
  },
  custom: {
    label: "Endpoint personalizado",
    keyEnv: "CUSTOM_AI_API_KEY",
    modelEnv: "CUSTOM_AI_MODEL",
    defaultModel: "",
    async call(req, model, key, signal) {
      const base = (process.env.CUSTOM_AI_BASE_URL ?? "").replace(/\/+$/, "");
      return openAICompatible(`${base}/chat/completions`, "Endpoint personalizado")(req, model, key, signal);
    },
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

function isConfigured(id: ProviderId): boolean {
  if (id === "custom") {
    const base = process.env.CUSTOM_AI_BASE_URL ?? "";
    return /^https?:\/\//.test(base) && !!process.env.CUSTOM_AI_MODEL;
  }
  return !!process.env[PROVIDERS[id].keyEnv]?.trim();
}

export function providerStatus(): ProviderStatus[] {
  return PROVIDER_IDS.map((id) => ({
    id,
    label: PROVIDERS[id].label,
    configured: isConfigured(id),
    model: process.env[PROVIDERS[id].modelEnv]?.trim() || PROVIDERS[id].defaultModel,
  }));
}

/**
 * Modo automático: tenta os fornecedores configurados por ordem e passa ao seguinte
 * quando um falha (quota, modelo indisponível, erro do servidor, tempo excedido).
 * Erros de credenciais também passam ao seguinte, mas ficam reportados.
 */
/** Ordem do modo Automático: primeiro os fornecedores com plano gratuito, depois os pagos. */
export const AUTO_ORDER: ProviderId[] = ["gemini", "openrouter", "custom", "anthropic", "openai"];

export async function generateWithFallback(req: GenerateRequest, order: ProviderId[] = AUTO_ORDER): Promise<{ text: string; model: string; provider: ProviderId; attempts: string[] }> {
  const candidates = order.filter(isConfigured);
  if (candidates.length === 0) throw new ProviderError("Nenhum fornecedor de IA está configurado no servidor (.env.local).", 400);
  const attempts: string[] = [];
  for (const id of candidates) {
    try {
      const r = await generate(id, req);
      return { ...r, provider: id, attempts };
    } catch (e) {
      attempts.push(e instanceof Error ? e.message : `${PROVIDERS[id].label}: erro.`);
    }
  }
  throw new ProviderError(`Todos os fornecedores falharam — ${attempts.join(" · ")}`, 502);
}

export async function generate(id: ProviderId, req: GenerateRequest, timeoutMs = 90_000): Promise<{ text: string; model: string }> {
  const def = PROVIDERS[id];
  if (!def) throw new ProviderError("Fornecedor desconhecido.", 400);
  if (!isConfigured(id)) throw new ProviderError(`${def.label} não está configurado no servidor (.env.local).`, 400);
  const model = process.env[def.modelEnv]?.trim() || def.defaultModel;
  const key = process.env[def.keyEnv]?.trim() ?? "";
  try {
    const text = await def.call(req, model, key, AbortSignal.timeout(timeoutMs));
    return { text, model };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new ProviderError(`${def.label}: tempo de resposta excedido.`, 504);
    throw new ProviderError(`${def.label}: não foi possível contactar o fornecedor.`);
  }
}
