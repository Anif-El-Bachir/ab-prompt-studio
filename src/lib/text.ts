/* Utilitários de texto usados pelos motores (sem dependências). */

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function sentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^[\s\-*•\d.)]+/, "").trim())
    .filter((s) => s.length > 2);
}

export function words(text: string): string[] {
  return normalize(text).split(/[^a-z0-9+#.]+/).filter(Boolean);
}

/** Procura termos (já normalizados) como palavra/expressão inteira. */
export function containsTerm(normText: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(normText);
}

export function countTerms(normText: string, terms: string[]): number {
  return terms.reduce((n, t) => n + (containsTerm(normText, t) ? 1 : 0), 0);
}

export function matchedTerms(normText: string, terms: string[]): string[] {
  return terms.filter((t) => containsTerm(normText, t));
}

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

export function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function slugify(s: string): string {
  return normalize(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "prompt";
}
