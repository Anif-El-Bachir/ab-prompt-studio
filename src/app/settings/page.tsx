"use client";

import { useRef, useState } from "react";
import { CheckCircle2, CircleDashed, Download, KeyRound, Upload } from "lucide-react";
import { PageHeader } from "@/components/Sidebar";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { ConfirmDialog, Modal, useToast } from "@/components/feedback";
import { useAiStatus, useLive, useRepo, useSettings } from "@/lib/hooks";
import { MODEL_PROFILES, TARGETS } from "@/lib/engines/models";
import { downloadText } from "@/lib/download";
import type { DetailLevel, TargetModel } from "@/lib/types";

const MAX_BACKUP = 50 * 1024 * 1024;

export default function SettingsPage() {
  const repo = useRepo();
  const toast = useToast();
  const [settings, save] = useSettings();
  const { providers, loading, error } = useAiStatus();
  const { data: counts } = useLive(async (r) => { const b = await r.exportAll(); return { prompts: b.data.prompts.length, projects: b.data.projects.length, analyses: b.data.analyses.length }; });
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; data: unknown } | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearText, setClearText] = useState("");

  async function exportBackup() {
    const b = await repo.exportAll();
    downloadText(`ab-prompt-studio-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, null, 2), "application/json");
    toast("Cópia de segurança exportada.");
  }

  async function onFile(f?: File) {
    if (!f) return;
    if (f.size > MAX_BACKUP) { toast("Ficheiro demasiado grande (máx. 50 MB).", "bad"); return; }
    try {
      const data = JSON.parse(await f.text());
      setPending({ name: f.name, data });
    } catch {
      toast("O ficheiro não é JSON válido.", "bad");
    } finally {
      if (file.current) file.current.value = "";
    }
  }

  async function doImport(mode: "merge" | "replace") {
    if (!pending) return;
    try {
      const r = await repo.importAll(pending.data, mode);
      toast(`Importado: ${Object.entries(r.counts).map(([k, v]) => `${v} ${k}`).join(", ")}.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha na importação.", "bad");
    }
    setPending(null);
  }

  return (
    <>
      <PageHeader title="Settings" description="Preferências, fornecedores de IA e cópias de segurança." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Preferências de geração">
          <div className="space-y-3">
            <Field label="Modelo de destino por omissão">
              <Select value={settings.defaultTarget} onChange={(e) => save({ defaultTarget: e.target.value as TargetModel })}>{TARGETS.map((t) => <option key={t} value={t}>{MODEL_PROFILES[t].label}</option>)}</Select>
            </Field>
            <Field label="Nível de detalhe por omissão">
              <Select value={settings.detail} onChange={(e) => save({ detail: e.target.value as DetailLevel })}><option value="compact">Compacto</option><option value="standard">Normal</option><option value="detailed">Detalhado</option></Select>
            </Field>
            <Field label="Idioma das respostas pedido ao modelo" htmlFor="st-lang" hint="Ex.: português de Portugal, português do Brasil, inglês">
              <Input id="st-lang" defaultValue={settings.responseLanguage} key={settings.responseLanguage} maxLength={60} onBlur={(e) => e.target.value.trim() && save({ responseLanguage: e.target.value.trim() })} />
            </Field>
          </div>
        </Card>

        <Card title="Modelo personalizado" subtitle="Define as capacidades reais do teu modelo (ex.: modelo local).">
          <div className="space-y-3">
            <Field label="Nome" htmlFor="cm-name"><Input id="cm-name" key={settings.customModel.name} defaultValue={settings.customModel.name} maxLength={60} onBlur={(e) => save({ customModel: { ...settings.customModel, name: e.target.value.trim() || "Modelo personalizado" } })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Formato"><Select value={settings.customModel.format} onChange={(e) => save({ customModel: { ...settings.customModel, format: e.target.value as "xml" | "markdown" | "plain" } })}><option value="markdown">Markdown</option><option value="xml">Etiquetas XML</option><option value="plain">Texto simples</option></Select></Field>
              <Field label="Tamanho máximo (caracteres)" htmlFor="cm-max" hint="0 = sem limite"><Input id="cm-max" type="number" min={0} max={1000000} key={settings.customModel.maxChars} defaultValue={settings.customModel.maxChars} onBlur={(e) => save({ customModel: { ...settings.customModel, maxChars: Math.max(0, Math.min(1_000_000, parseInt(e.target.value, 10) || 0)) } })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="accent-[var(--color-accent)]" checked={settings.customModel.supportsTools} onChange={(e) => save({ customModel: { ...settings.customModel, supportsTools: e.target.checked } })} /> Tem acesso a ficheiros/terminal/ferramentas</label>
          </div>
        </Card>

        <Card title="Fornecedores de IA" subtitle="Opcional. Sem fornecedores, todos os módulos funcionam com os motores locais." className="lg:col-span-2">
          {loading ? <p className="text-xs text-muted">A verificar…</p> : error ? <p className="text-xs text-warn">{error}</p> : (
            <>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {providers.map((p) => (
                  <li key={p.id} className="rounded-lg border border-line bg-bg p-3">
                    <div className="flex items-center gap-1.5 text-[13px]">{p.configured ? <CheckCircle2 className="size-4 text-ok" /> : <CircleDashed className="size-4 text-faint" />}{p.label}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted">{p.model || "—"}</div>
                    <Badge className="mt-2" tone={p.configured ? "ok" : "neutral"}>{p.configured ? "configurado" : "não configurado"}</Badge>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg border border-line bg-bg p-4 text-xs leading-relaxed text-muted">
                <div className="mb-1 flex items-center gap-1.5 text-[13px] text-fg"><KeyRound className="size-4 text-accent" /> Como configurar (seguro)</div>
                As chaves <strong className="text-fg">nunca</strong> são introduzidas nesta página nem guardadas no browser. Copia <code className="text-accent">.env.example</code> para <code className="text-accent">.env.local</code> na pasta do projeto, preenche a chave do fornecedor e reinicia o servidor. As chamadas são feitas apenas pelo servidor (<code>/api/ai/generate</code>), com validação, limite de pedidos e conteúdo delimitado como dados. Nenhuma chamada é feita sem clicares num botão de IA.
              </div>
            </>
          )}
        </Card>

        <Card title="Cópias de segurança" subtitle={counts ? `${counts.projects} projetos · ${counts.prompts} prompts · ${counts.analyses} análises neste browser` : undefined} className="lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Download className="size-4" />} onClick={exportBackup}>Exportar backup (JSON)</Button>
            <Button icon={<Upload className="size-4" />} onClick={() => file.current?.click()}>Importar backup</Button>
            <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="danger" className="ml-auto" onClick={() => { setClearText(""); setClearOpen(true); }}>Apagar todos os dados locais</Button>
          </div>
          <p className="mt-3 text-xs text-faint">Os dados vivem no IndexedDB deste browser. Limpar os dados do site, usar modo privado ou mudar de browser/dispositivo faz com que deixem de estar disponíveis — exporta regularmente. O ficheiro importado é validado antes de qualquer alteração.</p>
        </Card>
      </div>

      <Modal open={!!pending} onClose={() => setPending(null)} title="Importar backup" footer={<><Button variant="ghost" onClick={() => setPending(null)}>Cancelar</Button><Button onClick={() => doImport("merge")}>Juntar aos dados atuais</Button><Button variant="danger" onClick={() => doImport("replace")}>Substituir tudo</Button></>}>
        <p className="text-muted">Ficheiro: <span className="text-fg">{pending?.name}</span></p>
        <p className="mt-2 text-muted"><strong className="text-fg">Juntar</strong> mantém os dados atuais e acrescenta/atualiza os do ficheiro (mesmo ID = substituído). <strong className="text-fg">Substituir</strong> apaga primeiro todos os dados locais.</p>
      </Modal>
      <ConfirmDialog
        open={clearOpen}
        danger
        onCancel={() => setClearOpen(false)}
        onConfirm={async () => { if (clearText !== "APAGAR") { toast("Escreve APAGAR para confirmar.", "bad"); return; } await repo.clearAll(); setClearOpen(false); toast("Todos os dados locais foram apagados."); }}
        title="Apagar todos os dados locais?"
        confirmLabel="Apagar definitivamente"
        text={<div className="space-y-2"><p>Remove projetos, prompts, versões, coleções, análises, atividade e preferências deste browser. Não pode ser desfeito — exporta um backup antes.</p><Input aria-label="Escreve APAGAR" value={clearText} onChange={(e) => setClearText(e.target.value)} placeholder="Escreve APAGAR" /></div>}
      />
    </>
  );
}
