import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authConfig, checkPassword, createSessionToken, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";

export const dynamic = "force-dynamic";

/* Limite de tentativas por IP (em memória). */
const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  const { enabled } = authConfig();
  if (!enabled) return NextResponse.json({ error: "A proteção por palavra-passe não está ativa neste servidor." }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) return NextResponse.json({ error: "Demasiadas tentativas. Espera 10 minutos." }, { status: 429 });

  const parsed = z.object({ password: z.string().min(1).max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success || !(await checkPassword(parsed.data.password))) {
    recent.push(now);
    attempts.set(ip, recent);
    await new Promise((r) => setTimeout(r, 400)); // abranda tentativas automáticas
    return NextResponse.json({ error: "Palavra-passe incorreta." }, { status: 401 });
  }

  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
