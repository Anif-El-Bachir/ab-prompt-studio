import { StudioDB } from "./db";
import { BackupSchema, type Backup } from "./schemas";
import type {
  Activity, ActivityType, AnalysisRecord, AppSettings, Collection, Project, PromptRecord, PromptVersion,
} from "../types";

/**
 * Contrato de persistência. A implementação atual usa IndexedDB (local);
 * uma implementação cloud (ex.: REST/Supabase) pode implementar a mesma interface
 * sem alterar as páginas.
 */
export interface Repository {
  // projetos
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  saveProject(p: Omit<Project, "id" | "createdAt" | "updatedAt"> & Partial<Pick<Project, "id" | "createdAt">>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  // prompts
  listPrompts(): Promise<PromptRecord[]>;
  getPrompt(id: string): Promise<PromptRecord | undefined>;
  createPrompt(p: NewPrompt): Promise<PromptRecord>;
  updatePrompt(id: string, patch: Partial<Omit<PromptRecord, "id" | "createdAt" | "version">>, versionNote?: string): Promise<PromptRecord>;
  duplicatePrompt(id: string): Promise<PromptRecord>;
  deletePrompt(id: string): Promise<void>;
  listVersions(promptId: string): Promise<PromptVersion[]>;
  restoreVersion(promptId: string, versionId: string): Promise<PromptRecord>;
  // coleções
  listCollections(): Promise<Collection[]>;
  createCollection(name: string, description?: string): Promise<Collection>;
  renameCollection(id: string, name: string): Promise<void>;
  deleteCollection(id: string): Promise<void>;
  // análises
  listAnalyses(): Promise<AnalysisRecord[]>;
  saveAnalysis(a: Omit<AnalysisRecord, "id" | "createdAt">): Promise<AnalysisRecord>;
  deleteAnalysis(id: string): Promise<void>;
  // atividade e definições
  listActivity(limit?: number): Promise<Activity[]>;
  log(type: ActivityType, message: string, refId?: string): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(s: Partial<Omit<AppSettings, "id">>): Promise<AppSettings>;
  // backup
  exportAll(): Promise<Backup>;
  importAll(data: unknown, mode: "merge" | "replace"): Promise<{ counts: Record<string, number> }>;
  clearAll(): Promise<void>;
}

export type NewPrompt = Omit<PromptRecord, "id" | "createdAt" | "updatedAt" | "version" | "favorite" | "tags" | "collectionIds"> &
  Partial<Pick<PromptRecord, "favorite" | "tags" | "collectionIds">>;

export const DEFAULT_SETTINGS: AppSettings = {
  id: "app",
  defaultTarget: "claude",
  responseLanguage: "português de Portugal",
  detail: "standard",
  customModel: { name: "Modelo personalizado", format: "markdown", supportsTools: false, maxChars: 0 },
};

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* Notificação de alterações para as vistas reativas. */
type Listener = () => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((l) => l());
}

export class IndexedDbRepository implements Repository {
  constructor(private db: StudioDB = new StudioDB()) {}

  private async write<T>(fn: () => Promise<T>): Promise<T> {
    const r = await fn();
    emit();
    return r;
  }

  /* ---- projetos ---- */
  listProjects() { return this.db.projects.orderBy("updatedAt").reverse().toArray(); }
  getProject(id: string) { return this.db.projects.get(id); }
  saveProject(p: Parameters<Repository["saveProject"]>[0]) {
    return this.write(async () => {
      const now = Date.now();
      const existing = p.id ? await this.db.projects.get(p.id) : undefined;
      const rec: Project = { ...p, id: p.id ?? uid(), createdAt: existing?.createdAt ?? p.createdAt ?? now, updatedAt: now } as Project;
      await this.db.projects.put(rec);
      await this.logRaw(existing ? "project.updated" : "project.created", existing ? `Projeto atualizado: ${rec.title}` : `Projeto criado: ${rec.title}`, rec.id);
      return rec;
    });
  }
  deleteProject(id: string) {
    return this.write(async () => { await this.db.projects.delete(id); });
  }

  /* ---- prompts ---- */
  listPrompts() { return this.db.prompts.orderBy("updatedAt").reverse().toArray(); }
  getPrompt(id: string) { return this.db.prompts.get(id); }
  createPrompt(p: NewPrompt) {
    return this.write(async () => {
      const now = Date.now();
      const rec: PromptRecord = { favorite: false, tags: [], collectionIds: [], ...p, id: uid(), version: 1, createdAt: now, updatedAt: now };
      await this.db.transaction("rw", this.db.prompts, this.db.promptVersions, this.db.activity, async () => {
        await this.db.prompts.add(rec);
        await this.db.promptVersions.add({ id: uid(), promptId: rec.id, version: 1, title: rec.title, content: rec.content, note: "Versão inicial", createdAt: now });
        await this.logRaw("prompt.created", `Prompt criado: ${rec.title}`, rec.id);
      });
      return rec;
    });
  }
  updatePrompt(id: string, patch: Parameters<Repository["updatePrompt"]>[1], versionNote = "") {
    return this.write(async () => {
      const cur = await this.db.prompts.get(id);
      if (!cur) throw new Error("Prompt não encontrado.");
      const contentChanged = (patch.content !== undefined && patch.content !== cur.content) || (patch.title !== undefined && patch.title !== cur.title);
      const next: PromptRecord = { ...cur, ...patch, id, version: contentChanged ? cur.version + 1 : cur.version, updatedAt: Date.now() };
      await this.db.transaction("rw", this.db.prompts, this.db.promptVersions, this.db.activity, async () => {
        await this.db.prompts.put(next);
        if (contentChanged) {
          await this.db.promptVersions.add({ id: uid(), promptId: id, version: next.version, title: next.title, content: next.content, note: versionNote || `Versão ${next.version}`, createdAt: next.updatedAt });
          await this.logRaw("prompt.updated", `Prompt atualizado (v${next.version}): ${next.title}`, id);
        }
      });
      return next;
    });
  }
  async duplicatePrompt(id: string) {
    const cur = await this.db.prompts.get(id);
    if (!cur) throw new Error("Prompt não encontrado.");
    const { id: _i, createdAt: _c, updatedAt: _u, version: _v, ...rest } = cur;
    return this.createPrompt({ ...rest, title: `${cur.title} (cópia)` });
  }
  deletePrompt(id: string) {
    return this.write(async () => {
      const cur = await this.db.prompts.get(id);
      await this.db.transaction("rw", this.db.prompts, this.db.promptVersions, this.db.activity, async () => {
        await this.db.prompts.delete(id);
        await this.db.promptVersions.where("promptId").equals(id).delete();
        if (cur) await this.logRaw("prompt.deleted", `Prompt eliminado: ${cur.title}`);
      });
    });
  }
  listVersions(promptId: string) {
    return this.db.promptVersions.where("promptId").equals(promptId).reverse().sortBy("version");
  }
  async restoreVersion(promptId: string, versionId: string) {
    const v = await this.db.promptVersions.get(versionId);
    if (!v || v.promptId !== promptId) throw new Error("Versão não encontrada.");
    return this.updatePrompt(promptId, { content: v.content, title: v.title }, `Restaurada a partir da v${v.version}`);
  }

  /* ---- coleções ---- */
  listCollections() { return this.db.collections.orderBy("name").toArray(); }
  createCollection(name: string, description = "") {
    return this.write(async () => {
      const clean = name.trim();
      if (!clean) throw new Error("O nome da coleção é obrigatório.");
      const c: Collection = { id: uid(), name: clean.slice(0, 80), description, createdAt: Date.now() };
      await this.db.collections.add(c);
      await this.logRaw("collection.created", `Coleção criada: ${c.name}`, c.id);
      return c;
    });
  }
  renameCollection(id: string, name: string) {
    return this.write(async () => {
      if (!name.trim()) throw new Error("O nome da coleção é obrigatório.");
      await this.db.collections.update(id, { name: name.trim().slice(0, 80) });
    });
  }
  deleteCollection(id: string) {
    return this.write(async () => {
      await this.db.transaction("rw", this.db.collections, this.db.prompts, async () => {
        await this.db.collections.delete(id);
        const affected = await this.db.prompts.where("collectionIds").equals(id).toArray();
        for (const p of affected) await this.db.prompts.update(p.id, { collectionIds: p.collectionIds.filter((c) => c !== id) });
      });
    });
  }

  /* ---- análises ---- */
  listAnalyses() { return this.db.analyses.orderBy("createdAt").reverse().toArray(); }
  saveAnalysis(a: Omit<AnalysisRecord, "id" | "createdAt">) {
    return this.write(async () => {
      const rec: AnalysisRecord = { ...a, id: uid(), createdAt: Date.now() };
      await this.db.analyses.add(rec);
      await this.logRaw("analysis.created", `Ideia analisada: ${rec.title}`, rec.id);
      return rec;
    });
  }
  deleteAnalysis(id: string) { return this.write(async () => { await this.db.analyses.delete(id); }); }

  /* ---- atividade ---- */
  listActivity(limit = 20) { return this.db.activity.orderBy("createdAt").reverse().limit(limit).toArray(); }
  private async logRaw(type: ActivityType, message: string, refId?: string) {
    await this.db.activity.add({ id: uid(), type, message: message.slice(0, 200), refId, createdAt: Date.now() });
  }
  log(type: ActivityType, message: string, refId?: string) { return this.write(() => this.logRaw(type, message, refId)); }

  /* ---- definições ---- */
  async getSettings() {
    const s = await this.db.settings.get("app");
    return { ...DEFAULT_SETTINGS, ...s, customModel: { ...DEFAULT_SETTINGS.customModel, ...s?.customModel } };
  }
  saveSettings(patch: Partial<Omit<AppSettings, "id">>) {
    return this.write(async () => {
      const next = { ...(await this.getSettings()), ...patch, id: "app" as const };
      await this.db.settings.put(next);
      return next;
    });
  }

  /* ---- backup ---- */
  async exportAll(): Promise<Backup> {
    const [projects, prompts, promptVersions, collections, analyses, activity, settings] = await Promise.all([
      this.db.projects.toArray(), this.db.prompts.toArray(), this.db.promptVersions.toArray(), this.db.collections.toArray(),
      this.db.analyses.toArray(), this.db.activity.toArray(), this.db.settings.toArray(),
    ]);
    return { app: "ab-prompt-studio", schemaVersion: 1, exportedAt: new Date().toISOString(), data: { projects, prompts, promptVersions, collections, analyses, activity, settings } } as unknown as Backup;
  }
  importAll(input: unknown, mode: "merge" | "replace") {
    return this.write(async () => {
      const parsed = BackupSchema.safeParse(input);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(`Ficheiro de backup inválido: ${issue.path.join(".") || "raiz"} — ${issue.message}`);
      }
      const d = parsed.data.data;
      const tables = [this.db.projects, this.db.prompts, this.db.promptVersions, this.db.collections, this.db.analyses, this.db.activity, this.db.settings];
      await this.db.transaction("rw", tables, async () => {
        if (mode === "replace") await Promise.all(tables.map((t) => t.clear()));
        await this.db.projects.bulkPut(d.projects as Project[]);
        await this.db.prompts.bulkPut(d.prompts as PromptRecord[]);
        await this.db.promptVersions.bulkPut(d.promptVersions as PromptVersion[]);
        await this.db.collections.bulkPut(d.collections as Collection[]);
        await this.db.analyses.bulkPut(d.analyses as AnalysisRecord[]);
        await this.db.activity.bulkPut(d.activity as Activity[]);
        if (d.settings.length) await this.db.settings.bulkPut(d.settings as AppSettings[]);
        await this.logRaw("backup.imported", `Backup importado (${mode === "replace" ? "substituição" : "fusão"})`);
      });
      return { counts: { projetos: d.projects.length, prompts: d.prompts.length, versões: d.promptVersions.length, coleções: d.collections.length, análises: d.analyses.length } };
    });
  }
  clearAll() {
    return this.write(async () => {
      await Promise.all([this.db.projects, this.db.prompts, this.db.promptVersions, this.db.collections, this.db.analyses, this.db.activity, this.db.settings].map((t) => t.clear()));
    });
  }
}

let singleton: Repository | null = null;
export function getRepository(): Repository {
  if (!singleton) singleton = new IndexedDbRepository();
  return singleton;
}
