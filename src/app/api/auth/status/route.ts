import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Indica apenas se a proteção está ativa (nunca a palavra-passe). */
export function GET() {
  return NextResponse.json({ enabled: authConfig().enabled }, { headers: { "Cache-Control": "no-store" } });
}
