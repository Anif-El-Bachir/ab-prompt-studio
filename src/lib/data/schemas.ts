import { z } from "zod";

/* Validação de dados importados (backup). Campos essenciais são verificados;
 * estruturas derivadas (análises, arquiteturas) passam como objetos. */

const id = z.string().min(1).max(100);
const ts = z.number().int().nonnegative();
const category = z.enum(["software", "website", "app", "agent", "multiagent", "automation", "business", "marketing", "content", "data", "organization", "security"]);
const target = z.enum(["claude", "claude-code", "chatgpt", "codex", "gemini", "openrouter", "custom"]);

export const ProjectSchema = z.object({
  id, title: z.string().max(300), idea: z.string().max(50000), status: z.enum(["draft", "analysed", "in-development", "done"]),
  category, step: z.number().int().min(0).max(10), answers: z.record(z.string()),
  interpretation: z.any().optional(), analysis: z.any().optional(), architecture: z.any().optional(), promptId: z.string().optional(),
  createdAt: ts, updatedAt: ts,
}).passthrough();

export const PromptSchema = z.object({
  id, title: z.string().max(300), content: z.string().max(200000), target, category,
  tags: z.array(z.string().max(60)).max(50), collectionIds: z.array(z.string()).max(100),
  projectId: z.string().optional(), spec: z.any().optional(), score: z.number().optional(),
  favorite: z.boolean(), version: z.number().int().min(1), createdAt: ts, updatedAt: ts,
}).passthrough();

export const PromptVersionSchema = z.object({ id, promptId: id, version: z.number().int().min(1), title: z.string().max(300), content: z.string().max(200000), note: z.string().max(500), createdAt: ts });
export const CollectionSchema = z.object({ id, name: z.string().min(1).max(80), description: z.string().max(500), createdAt: ts });
export const AnalysisSchema = z.object({ id, title: z.string().max(300), idea: z.string().max(50000), category, result: z.any(), projectId: z.string().optional(), createdAt: ts }).passthrough();
export const ActivitySchema = z.object({ id, type: z.string().max(60), message: z.string().max(300), refId: z.string().optional(), createdAt: ts });
export const SettingsSchema = z.object({
  id: z.literal("app"), defaultTarget: target, responseLanguage: z.string().max(80), detail: z.enum(["compact", "standard", "detailed"]),
  customModel: z.object({ name: z.string().max(80), format: z.enum(["xml", "markdown", "plain"]), supportsTools: z.boolean(), maxChars: z.number().int().min(0).max(1_000_000) }),
});

export const BackupSchema = z.object({
  app: z.literal("ab-prompt-studio"),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  data: z.object({
    projects: z.array(ProjectSchema).default([]),
    prompts: z.array(PromptSchema).default([]),
    promptVersions: z.array(PromptVersionSchema).default([]),
    collections: z.array(CollectionSchema).default([]),
    analyses: z.array(AnalysisSchema).default([]),
    activity: z.array(ActivitySchema).default([]),
    settings: z.array(SettingsSchema).default([]),
  }),
});

export type Backup = z.infer<typeof BackupSchema>;
