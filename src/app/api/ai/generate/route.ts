import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generate, generateWithFallback, PROVIDER_IDS, ProviderError, type ProviderId } from "@/lib/ai/providers";
import { AI_TASKS, type AiTask } from "@/lib/ai/tasks";
import { cleanInput, detectInjection, fenceAsData } from "@/lib/engines/sanitize";

export const dynamic = "force-dynamic";

const Body = z.object({
  provider: z.union([z.literal("auto"), z.enum(PROVIDER_IDS as [ProviderId, ...ProviderId[]])]),
  task: z.enum(Object.keys(AI_TASKS) as [AiTask, ...AiTask[]]),
  input: z.string().min(1, "O conteúdo está vazio.").max(30000, "Conteúdo demasiado longo (máx. 30 000 caracteres)."),
});

/* Limite simples por IP (em memória; suficiente para uso local/único servidor). */
const WINDOW_MS = 60_000;
const MAX_REQ = 10;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_REQ;
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // pedidos sem Origin (ex.: mesmo site via fetch em alguns browsers) — o host é verificado abaixo
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return NextResponse.json({ error: "Demasiados pedidos. Aguarda um minuto." }, { status: 429 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo do pedido inválido." }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido." }, { status: 400 });

  const { provider, task, input } = parsed.data;
  const clean = cleanInput(input, 30000);
  const warnings = detectInjection(input);
  try {
    const req = { system: AI_TASKS[task].system, user: fenceAsData(clean) };
    if (provider === "auto") {
      const r = await generateWithFallback(req);
      return NextResponse.json({ text: r.text, model: r.model, provider: r.provider, attempts: r.attempts, warnings });
    }
    const { text, model } = await generate(provider, req);
    return NextResponse.json({ text, model, provider, attempts: [], warnings });
  } catch (e) {
    const err = e instanceof ProviderError ? e : new ProviderError("Erro inesperado.");
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
