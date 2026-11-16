"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookMarked, Copy as CopyIcon, Download, FolderPlus, Pencil, Search, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/Sidebar";
import { Badge, Button, Card, EmptyState, Input, Select, cx } from "@/components/ui";
import { ConfirmDialog, CopyButton, Modal, useToast } from "@/components/feedback";
import { useLive, useRepo } from "@/lib/hooks";
import { CATEGORIES, getCategory } from "@/lib/engines/categories";
import { MODEL_PROFILES, TARGETS } from "@/lib/engines/models";
import { downloadText, exportPrompt, timeAgo } from "@/lib/download";
import { normalize } from "@/lib/text";
import type { Collection, PromptRecord } from "@/lib/types";

type Sort = "updated" | "created" | "title" | "score";

export default function Library() {
  const repo = useRepo();
  const toast = useToast();
  const { data } = useLive(async (r) => ({ prompts: await r.listPrompts(), collections: await r.listCollections() }));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [target, setTarget] = useState("all");
  const [col, setCol] = useState("all");
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("updated");
  const [toDelete, setToDelete] = useState<PromptRecord>();
  const [colModal, setColModal] = useState<{ mode: "create" } | { mode: "rename"; c: Collection } | null>(null);
  const [colName, setColName] = useState("");
  const [colDelete, setColDelete] = useState<Collection>();

  const list = useMemo(() => {
    if (!data) return [];
    const nq = normalize(q);
    const r = data.prompts.filter((p) =>
      (cat === "all" || p.category === cat) &&
      (target === "all" || p.target === target) &&
      (col === "all" || (col === "none" ? p.collectionIds.length === 0 : p.collectionIds.includes(col))) &&
      (!favOnly || p.favorite) &&
      (!nq || normalize(`${p.title} ${p.tags.join(" ")} ${p.content}`).includes(nq)),
    );
    const s = [...r];
    if (sort === "title") s.sort((a, b) => a.title.localeCompare(b.title, "pt"));
    else if (sort === "created") s.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "score") s.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return s;
  }, [data, q, cat, target, col, favOnly, sort]);

  const colCount = (id: string) => data?.prompts.filter((p) => p.collectionIds.includes(id)).length ?? 0;

  function exportFiltered(format: "md" | "txt") {
    if (!list.length) return;
    const body = list.map((p) => format === "md" ? `# ${p.title}\n\n> ${MODEL_PROFILES[p.target].label} · ${getCategory(p.category).label} · v${p.version}\n\n${p.content}` : `===== ${p.title} (v${p.version}) =====\n\n${p.content}`).join(format === "md" ? "\n\n---\n\n" : "\n\n\n");
    downloadText(`biblioteca-prompts.${format}`, body, format === "md" ? "text/markdown" : "text/plain");
  }

  async function saveCollection() {
    try {
      if (colModal?.mode === "create") { await repo.createCollection(colName); toast("Coleção criada."); }
      else if (colModal?.mode === "rename") { await repo.renameCollection(colModal.c.id, colName); toast("Coleção renomeada."); }
      setColModal(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro.", "bad");
    }
  }

  return (
    <>
      <PageHeader
        title="My Prompt Library"
        description="Guarda, organiza, pesquisa e versiona os teus prompts."
        actions={
          <>
            <Button size="sm" icon={<Download className="size-3.5" />} disabled={!list.length} onClick={() => exportFiltered("md")}>Exportar .md ({list.length})</Button>
            <Button size="sm" icon={<Download className="size-3.5" />} disabled={!list.length} onClick={() => exportFiltered("txt")}>.txt</Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card title="Coleções" action={<button aria-label="Nova coleção" onClick={() => { setColName(""); setColModal({ mode: "create" }); }} className="rounded p-1 text-muted hover:bg-raised hover:text-fg"><FolderPlus className="size-4" /></button>} className="h-fit">
          <ul className="-mx-2 space-y-0.5 text-[13px]">
            {[{ id: "all", name: "Todos os prompts" }, { id: "none", name: "Sem coleção" }].map((c) => (
              <li key={c.id}><button onClick={() => setCol(c.id)} className={cx("w-full rounded-md px-2 py-1.5 text-left hover:bg-raised", col === c.id && "bg-raised text-accent")}>{c.name}</button></li>
            ))}
            {data?.collections.map((c) => (
              <li key={c.id} className="group flex items-center">
                <button onClick={() => setCol(c.id)} className={cx("min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left hover:bg-raised", col === c.id && "bg-raised text-accent")}>{c.name} <span className="text-faint">· {colCount(c.id)}</span></button>
                <button aria-label={`Renomear ${c.name}`} onClick={() => { setColName(c.name); setColModal({ mode: "rename", c }); }} className="rounded p-1 text-faint opacity-0 hover:text-fg group-hover:opacity-100 focus:opacity-100"><Pencil className="size-3" /></button>
                <button aria-label={`Eliminar ${c.name}`} onClick={() => setColDelete(c)} className="rounded p-1 text-faint opacity-0 hover:text-bad group-hover:opacity-100 focus:opacity-100"><Trash2 className="size-3" /></button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,150px))_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input aria-label="Pesquisar" className="pl-9" placeholder="Pesquisar título, etiquetas, conteúdo…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">Todas as categorias</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.short}</option>)}</Select>
            <Select aria-label="Modelo" value={target} onChange={(e) => setTarget(e.target.value)}><option value="all">Todos os modelos</option>{TARGETS.map((t) => <option key={t} value={t}>{MODEL_PROFILES[t].label}</option>)}</Select>
            <Select aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="updated">Mais recentes</option><option value="created">Data de criação</option><option value="title">Título (A–Z)</option><option value="score">Pontuação</option></Select>
            <Button aria-pressed={favOnly} variant={favOnly ? "primary" : "secondary"} icon={<Star className="size-4" />} onClick={() => setFavOnly((v) => !v)}>Favoritos</Button>
          </div>

          {data && data.prompts.length === 0 ? (
            <EmptyState icon={<BookMarked className="size-6" />} title="A biblioteca está vazia" text="Gera um prompt no Prompt Architect ou num projeto e clica em Guardar." action={<Link href="/architect"><Button variant="primary" size="sm">Abrir Prompt Architect</Button></Link>} />
          ) : list.length === 0 ? (
            <EmptyState icon={<Search className="size-6" />} title="Nenhum prompt corresponde aos filtros" />
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {list.map((p) => (
                <li key={p.id} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-colors hover:border-line-strong">
                  <div className="flex items-start gap-2">
                    <Link href={`/library/${p.id}`} className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium hover:text-accent">{p.title}</div>
                      <div className="mt-0.5 text-[11px] text-faint">{MODEL_PROFILES[p.target].label} · {getCategory(p.category).short} · {timeAgo(p.updatedAt)}</div>
                    </Link>
                    <button aria-label={p.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} aria-pressed={p.favorite} onClick={() => repo.updatePrompt(p.id, { favorite: !p.favorite })} className={cx("rounded p-1", p.favorite ? "text-accent" : "text-faint hover:text-fg")}><Star className="size-4" fill={p.favorite ? "currentColor" : "none"} /></button>
                  </div>
                  <p className="mt-2 line-clamp-3 font-mono text-[11.5px] leading-relaxed text-muted">{p.content.slice(0, 300)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    <Badge>v{p.version}</Badge>
                    {p.score !== undefined && <Badge tone={p.score >= 70 ? "ok" : p.score >= 45 ? "warn" : "bad"}>{p.score}/100</Badge>}
                    {p.tags.slice(0, 3).map((t) => <Badge key={t} tone="info">#{t}</Badge>)}
                    {p.collectionIds.map((cid) => data?.collections.find((c) => c.id === cid)).filter(Boolean).slice(0, 2).map((c) => <Badge key={c!.id} tone="accent">{c!.name}</Badge>)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                    <CopyButton text={p.content} />
                    <Link href={`/library/${p.id}`}><Button size="sm" icon={<Pencil className="size-3.5" />}>Editar</Button></Link>
                    <Button size="sm" variant="ghost" icon={<CopyIcon className="size-3.5" />} onClick={async () => { await repo.duplicatePrompt(p.id); toast("Prompt duplicado."); }}>Duplicar</Button>
                    <Button size="sm" variant="ghost" onClick={() => exportPrompt(p.title, p.content, "md", { target: MODEL_PROFILES[p.target].label, category: getCategory(p.category).label, version: p.version })}>.md</Button>
                    <Button size="sm" variant="ghost" onClick={() => exportPrompt(p.title, p.content, "txt")}>.txt</Button>
                    <Button size="sm" variant="ghost" className="ml-auto hover:text-bad" aria-label={`Eliminar ${p.title}`} icon={<Trash2 className="size-3.5" />} onClick={() => setToDelete(p)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal open={!!colModal} onClose={() => setColModal(null)} title={colModal?.mode === "rename" ? "Renomear coleção" : "Nova coleção"} footer={<><Button variant="ghost" onClick={() => setColModal(null)}>Cancelar</Button><Button variant="primary" disabled={!colName.trim()} onClick={saveCollection}>Guardar</Button></>}>
        <Input aria-label="Nome da coleção" autoFocus value={colName} maxLength={80} onChange={(e) => setColName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && colName.trim()) saveCollection(); }} placeholder="Ex.: Clientes, Marketing, Código" />
      </Modal>
      <ConfirmDialog open={!!toDelete} danger onCancel={() => setToDelete(undefined)} onConfirm={async () => { if (toDelete) { await repo.deletePrompt(toDelete.id); toast("Prompt eliminado."); } setToDelete(undefined); }} title="Eliminar prompt?" text={<>“{toDelete?.title}” e todas as suas versões serão removidos deste browser. Só é recuperável a partir de um backup.</>} confirmLabel="Eliminar" />
      <ConfirmDialog open={!!colDelete} danger onCancel={() => setColDelete(undefined)} onConfirm={async () => { if (colDelete) { await repo.deleteCollection(colDelete.id); if (col === colDelete.id) setCol("all"); toast("Coleção eliminada."); } setColDelete(undefined); }} title="Eliminar coleção?" text={`A coleção “${colDelete?.name}” será removida. Os prompts não são eliminados.`} confirmLabel="Eliminar coleção" />
    </>
  );
}
