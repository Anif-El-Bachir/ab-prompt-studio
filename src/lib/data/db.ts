import Dexie, { type EntityTable } from "dexie";
import type { Activity, AnalysisRecord, AppSettings, Collection, Project, PromptRecord, PromptVersion } from "../types";

export class StudioDB extends Dexie {
  projects!: EntityTable<Project, "id">;
  prompts!: EntityTable<PromptRecord, "id">;
  promptVersions!: EntityTable<PromptVersion, "id">;
  collections!: EntityTable<Collection, "id">;
  analyses!: EntityTable<AnalysisRecord, "id">;
  activity!: EntityTable<Activity, "id">;
  settings!: EntityTable<AppSettings, "id">;

  constructor(name = "ab-prompt-studio") {
    super(name);
    this.version(1).stores({
      projects: "id, status, category, updatedAt, createdAt",
      prompts: "id, category, target, projectId, favorite, updatedAt, createdAt, *collectionIds, *tags",
      promptVersions: "id, promptId, [promptId+version], createdAt",
      collections: "id, name, createdAt",
      analyses: "id, category, projectId, createdAt",
      activity: "id, type, createdAt",
      settings: "id",
    });
  }
}
