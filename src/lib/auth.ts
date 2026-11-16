/* Autenticação por palavra-passe única (uso pessoal).
 * Compatível com o runtime Edge (middleware): usa apenas Web Crypto.
 *
 * - APP_PASSWORD (variável de ambiente do servidor) ativa a proteção.
 * - A sessão é um cookie httpOnly "exp.assinatura" com HMAC-SHA256.
 * - O segredo de assinatura é AUTH_SECRET ou, na falta dele, derivado da palavra-passe
 *   (mudar a palavra-passe termina todas as sessões).
 * - Em produção alojada (VERCEL=1) ou com REQUIRE_AUTH=1, a ausência de APP_PASSWORD
 *   bloqueia a aplicação (falha fechada) em vez de a deixar aberta.
 */

export const SESSION_COOKIE = "abps_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

export function authConfig() {
  const password = process.env.APP_PASSWORD ?? "";
  const required = process.env.VERCEL === "1" || process.env.REQUIRE_AUTH === "1";
  return { enabled: password.length > 0, required, misconfigured: required && password.length === 0, password };
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

async function secretKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET || (await sha256Hex(`abps-session:${process.env.APP_PASSWORD ?? ""}`));
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(payload: string): Promise<string> {
  return toHex(await crypto.subtle.sign("HMAC", await secretKey(), enc.encode(payload)));
}

/** Comparação em tempo constante de duas strings hex do mesmo tamanho. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const exp = String(now + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return `${exp}.${await sign(exp)}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return safeEqual(sig, await sign(exp));
}

/** Verifica a palavra-passe comparando hashes em tempo constante. */
export async function checkPassword(candidate: string): Promise<boolean> {
  const { password, enabled } = authConfig();
  if (!enabled) return false;
  return safeEqual(await sha256Hex(candidate), await sha256Hex(password));
}
