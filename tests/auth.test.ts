import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { middleware } from "@/middleware";
import { POST as login } from "@/app/api/auth/login/route";

const PW = "frase-de-teste-longa";

function req(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3100${path}`, { headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {} });
}

afterEach(() => { vi.unstubAllEnvs(); });

describe("sessão", () => {
  it("token válido é aceite; adulterado ou expirado é recusado", async () => {
    vi.stubEnv("APP_PASSWORD", PW);
    const t = await createSessionToken();
    expect(await verifySessionToken(t)).toBe(true);
    expect(await verifySessionToken(t.replace(/.$/, (c) => (c === "a" ? "b" : "a")))).toBe(false);
    expect(await verifySessionToken(`${Date.now() + 1e9}.abc`)).toBe(false);
    expect(await verifySessionToken(await createSessionToken(Date.now() - 31 * 864e5))).toBe(false);
    expect(await verifySessionToken(undefined)).toBe(false);
  });

  it("mudar a palavra-passe invalida as sessões antigas", async () => {
    vi.stubEnv("APP_PASSWORD", PW);
    const t = await createSessionToken();
    vi.stubEnv("APP_PASSWORD", "outra-palavra-passe");
    expect(await verifySessionToken(t)).toBe(false);
  });

  it("verifica a palavra-passe", async () => {
    vi.stubEnv("APP_PASSWORD", PW);
    expect(await checkPassword(PW)).toBe(true);
    expect(await checkPassword("errada")).toBe(false);
  });
});

describe("middleware", () => {
  it("sem APP_PASSWORD (uso local) deixa passar", async () => {
    vi.stubEnv("APP_PASSWORD", "");
    const r = await middleware(req("/library"));
    expect(r.headers.get("x-middleware-next")).toBe("1");
  });

  it("alojado no Vercel sem APP_PASSWORD bloqueia tudo (falha fechada)", async () => {
    vi.stubEnv("APP_PASSWORD", "");
    vi.stubEnv("VERCEL", "1");
    expect((await middleware(req("/"))).status).toBe(503);
    expect((await middleware(req("/api/ai/status"))).status).toBe(503);
  });

  it("com APP_PASSWORD redireciona páginas para /login e recusa APIs sem sessão", async () => {
    vi.stubEnv("APP_PASSWORD", PW);
    const page = await middleware(req("/library?x=1"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toBe("http://localhost:3100/login?next=%2Flibrary%3Fx%3D1");
    expect((await middleware(req("/api/ai/generate"))).status).toBe(401);
    expect((await middleware(req("/login"))).headers.get("x-middleware-next")).toBe("1");
    expect((await middleware(req("/api/auth/login"))).headers.get("x-middleware-next")).toBe("1");
  });

  it("com sessão válida deixa passar", async () => {
    vi.stubEnv("APP_PASSWORD", PW);
    const r = await middleware(req("/api/ai/status", await createSessionToken()));
    expect(r.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("rota de login", () => {
  const post = (body: unknown, ip: string) =>
    login(new NextRequest("http://localhost:3100/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }));

  it("palavra-passe certa define cookie httpOnly; errada devolve 401", async () => {
    vi.stubEnv("APP_PASSWORD", PW);
    const ok = await post({ password: PW }, "1.1.1.1");
    expect(ok.status).toBe(200);
    const setCookie = ok.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(new RegExp(`${SESSION_COOKIE}=\\d+\\.[0-9a-f]{64}`));
    expect(setCookie.toLowerCase()).toMatch(/httponly/);
    expect((await post({ password: "errada" }, "1.1.1.2")).status).toBe(401);
  });

  it("bloqueia após demasiadas tentativas", async () => {
    vi.stubEnv("APP_PASSWORD", PW);
    for (let i = 0; i < 8; i++) await post({ password: "x" }, "9.9.9.9");
    expect((await post({ password: PW }, "9.9.9.9")).status).toBe(429);
  }, 15000);
});
