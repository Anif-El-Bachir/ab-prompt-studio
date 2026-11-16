import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/* Adaptador do Claude com o SDK oficial da Anthropic — executa só no servidor.
 * Devolve texto ou lança um erro com estado HTTP e mensagem segura (sem detalhes da conta). */

export class AnthropicCallError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface AnthropicRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

export async function callAnthropic(req: AnthropicRequest, model: string, apiKey: string, signal: AbortSignal): Promise<string> {
  // maxRetries 0: as repetições e a passagem para outro fornecedor são feitas pela nossa camada (modo Automático).
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  try {
    const response = await client.beta.messages.create(
      {
        model,
        max_tokens: req.maxTokens ?? 16000,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: { effort: "medium" },
        // Se o modelo recusar por segurança, a API tenta outro modelo Claude no mesmo pedido.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal },
    );

    if (response.stop_reason === "refusal") {
      throw new AnthropicCallError("Claude: o modelo recusou este pedido por razões de segurança.", 422);
    }
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    if (!text) {
      throw new AnthropicCallError(
        response.stop_reason === "max_tokens" ? "Claude: a resposta atingiu o limite de tamanho sem texto final." : "Claude: resposta sem texto.",
        502,
      );
    }
    return text;
  } catch (e) {
    if (e instanceof AnthropicCallError) throw e;
    // Do mais específico para o mais geral; nunca se propaga a mensagem bruta da API.
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new AnthropicCallError("Claude: credenciais inválidas ou sem permissão.", 502);
    }
    if (e instanceof Anthropic.NotFoundError) {
      throw new AnthropicCallError("Claude: modelo não encontrado ou indisponível para esta conta — muda ANTHROPIC_MODEL no .env.local.", 502);
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new AnthropicCallError("Claude: quota ou limite de pedidos excedido (verifica os créditos na consola da Anthropic).", 429);
    }
    if (e instanceof Anthropic.APIConnectionTimeoutError || e instanceof Anthropic.APIUserAbortError) {
      throw new AnthropicCallError("Claude: tempo de resposta excedido.", 504);
    }
    if (e instanceof Anthropic.BadRequestError) {
      throw new AnthropicCallError("Claude: pedido rejeitado (verifica o modelo e os créditos da conta).", 502);
    }
    if (e instanceof Anthropic.APIError) {
      throw new AnthropicCallError(`Claude: erro do fornecedor${e.status ? ` (HTTP ${e.status})` : ""}.`, 502);
    }
    throw new AnthropicCallError("Claude: não foi possível contactar o fornecedor.", 502);
  }
}
