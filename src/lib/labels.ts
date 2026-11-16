import type { ProjectStatus } from "./types";

export const STATUS_LABEL: Record<ProjectStatus, { label: string; tone: "neutral" | "info" | "accent" | "ok" }> = {
  draft: { label: "Rascunho", tone: "neutral" },
  analysed: { label: "Analisado", tone: "info" },
  "in-development": { label: "Em desenvolvimento", tone: "accent" },
  done: { label: "Concluído", tone: "ok" },
};
