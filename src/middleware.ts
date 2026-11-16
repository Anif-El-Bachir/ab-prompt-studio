import { NextResponse, type NextRequest } from "next/server";
import { authConfig, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/* Protege todas as páginas e APIs quando APP_PASSWORD está definida.
 * Rotas públicas: /login, /api/auth/*, ícones, manifest e ficheiros estáticos. */

const PUBLIC = [/^\/login$/, /^\/api\/auth\//];

export async function middleware(req: NextRequest) {
  const { enabled, misconfigured } = authConfig();
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (misconfigured) {
    const msg = "Aplicação bloqueada: falta definir APP_PASSWORD no servidor.";
    return isApi ? NextResponse.json({ error: msg }, { status: 503 }) : new NextResponse(msg, { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!enabled || PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "Sessão necessária. Inicia sessão novamente." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname + search)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-maskable.svg|apple-icon.png|manifest.webmanifest|sw.js).*)"],
};
