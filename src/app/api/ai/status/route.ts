import { NextResponse } from "next/server";
import { providerStatus } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

/** Devolve quais fornecedores estão configurados — nunca as chaves. */
export function GET() {
  return NextResponse.json({ providers: providerStatus() }, { headers: { "Cache-Control": "no-store" } });
}
