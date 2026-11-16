import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { StudioDB } from "@/lib/data/db";
import { IndexedDbRepository } from "@/lib/data/repository";

let repo: IndexedDbRepository;
let n = 0;

beforeEach(() => {
  repo = new IndexedDbRepository(new StudioDB(`test-${n++}`));
});

const base = { title: "Prompt A", content: "conteúdo v1", target: "claude" as const, category: "software" as const };

describe("prompts e versões", () => {
  it("cria, edita (nova versão), restaura e duplica", async () => {
    const p = await repo.createPrompt(base);
    expect(p.version).toBe(1);
    const u = await repo.updatePrompt(p.id, { content: "conteúdo v2" }, "edição");
    expect(u.version).toBe(2);
    // alterar só metadados não cria versão
    const fav = await repo.updatePrompt(p.id, { favorite: true });
    expect(fav.version).toBe(2);
    const versions = await repo.listVersions(p.id);
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    const r = await repo.restoreVersion(p.id, versions[1].id);
    expect(r.content).toBe("conteúdo v1");
    expect(r.version).toBe(3);
    const d = await repo.duplicatePrompt(p.id);
    expect(d.id).not.toBe(p.id);
    expect(d.title).toMatch(/cópia/);
    expect((await repo.listPrompts()).length).toBe(2);
  });

  it("eliminar prompt remove as versões", async () => {
    const p = await repo.createPrompt(base);
    await repo.updatePrompt(p.id, { content: "x" });
    await repo.deletePrompt(p.id);
    expect(await repo.listVersions(p.id)).toHaveLength(0);
  });
});

describe("coleções", () => {
  it("eliminar coleção retira-a dos prompts", async () => {
    const c = await repo.createCollection("Clientes");
    const p = await repo.createPrompt({ ...base, collectionIds: [c.id] });
    await repo.deleteCollection(c.id);
    expect((await repo.getPrompt(p.id))?.collectionIds).toEqual([]);
  });

  it("rejeita nome vazio", async () => {
    await expect(repo.createCollection("  ")).rejects.toThrow(/obrigatório/);
  });
});

describe("backup", () => {
  it("exporta e reimporta (substituição) mantendo os dados", async () => {
    await repo.createPrompt(base);
    await repo.saveProject({ title: "Proj", idea: "ideia", status: "draft", category: "software", step: 0, answers: {} });
    await repo.saveSettings({ defaultTarget: "gemini" });
    const backup = JSON.parse(JSON.stringify(await repo.exportAll()));

    const other = new IndexedDbRepository(new StudioDB(`test-import-${n++}`));
    const r = await other.importAll(backup, "replace");
    expect(r.counts.prompts).toBe(1);
    expect(r.counts.projetos).toBe(1);
    expect((await other.getSettings()).defaultTarget).toBe("gemini");
  });

  it("rejeita ficheiros inválidos sem alterar dados", async () => {
    await repo.createPrompt(base);
    await expect(repo.importAll({ app: "outra" }, "replace")).rejects.toThrow(/inválido/);
    await expect(repo.importAll({ app: "ab-prompt-studio", schemaVersion: 1, exportedAt: "x", data: { prompts: [{ id: 1 }] } }, "replace")).rejects.toThrow(/inválido/);
    expect((await repo.listPrompts()).length).toBe(1);
  });
});
