import { slugify } from "./text";

export function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportPrompt(title: string, content: string, format: "md" | "txt", meta?: { target?: string; category?: string; version?: number }) {
  const name = `${slugify(title)}.${format}`;
  if (format === "txt") return downloadText(name, content);
  const header = [`# ${title}`, meta ? `> Destino: ${meta.target ?? "—"} · Categoria: ${meta.category ?? "—"}${meta.version ? ` · v${meta.version}` : ""} · Exportado de AB Prompt Studio em ${new Date().toLocaleString("pt-PT")}` : ""].filter(Boolean).join("\n\n");
  downloadText(name, `${header}\n\n${content}\n`, "text/markdown");
}

export function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "agora mesmo";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} dia${d > 1 ? "s" : ""}`;
  return new Date(ts).toLocaleDateString("pt-PT");
}
