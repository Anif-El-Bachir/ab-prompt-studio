"use client";

import Link from "next/link";
import { Activity as ActivityIcon, ArrowRight, BookMarked, FolderKanban, Lightbulb, PenTool, Plus, Rocket } from "lucide-react";
import { PageHeader } from "@/components/Sidebar";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { useLive } from "@/lib/hooks";
import { timeAgo } from "@/lib/download";
import { getCategory } from "@/lib/engines/categories";
import { STATUS_LABEL } from "@/lib/labels";

export default function Dashboard() {
  const { data, loading } = useLive(async (r) => {
    const [projects, prompts, analyses, activity] = await Promise.all([r.listProjects(), r.listPrompts(), r.listAnalyses(), r.listActivity(12)]);
    return { projects, prompts, analyses, activity };
  });

  const stats = [
    { label: "Projetos", value: data?.projects.length ?? 0, icon: FolderKanban, href: "/new" },
    { label: "Prompts criados", value: data?.prompts.length ?? 0, icon: BookMarked, href: "/library" },
    { label: "Ideias analisadas", value: data?.analyses.length ?? 0, icon: Lightbulb, href: "/analyzer" },
    { label: "Em desenvolvimento", value: data?.projects.filter((p) => p.status === "in-development").length ?? 0, icon: Rocket, href: "/new" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral dos teus projetos, prompts e análises."
        actions={<Link href="/new"><Button variant="primary" icon={<Plus className="size-4" />}>Novo projeto</Button></Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="group rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-colors hover:border-line-strong">
            <div className="flex items-center justify-between text-faint"><span className="text-xs text-muted">{label}</span><Icon className="size-4 group-hover:text-accent" strokeWidth={1.75} /></div>
            <div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{loading ? "·" : value}</div>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Projetos recentes" action={<Link href="/new" className="text-xs text-muted hover:text-fg">Novo →</Link>}>
          {data && data.projects.length === 0 ? (
            <EmptyState icon={<FolderKanban className="size-6" />} title="Ainda não tens projetos" text="Começa por descrever uma ideia. O sistema interpreta, faz perguntas, avalia e gera a arquitetura e o prompt." action={<Link href="/new"><Button variant="primary" size="sm">Criar o primeiro projeto</Button></Link>} />
          ) : (
            <ul className="divide-y divide-line">
              {data?.projects.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/new?project=${p.id}`} className="flex items-center gap-3 py-3 first:pt-0 hover:text-accent">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{p.title}</div>
                      <div className="text-xs text-faint">{getCategory(p.category).label} · {timeAgo(p.updatedAt)}</div>
                    </div>
                    <Badge tone={STATUS_LABEL[p.status].tone}>{STATUS_LABEL[p.status].label}</Badge>
                    <ArrowRight className="size-3.5 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Atividade recente">
          {data && data.activity.length === 0 ? (
            <p className="text-xs text-faint">Sem atividade ainda.</p>
          ) : (
            <ul className="space-y-3">
              {data?.activity.map((a) => (
                <li key={a.id} className="flex gap-2.5">
                  <ActivityIcon className="mt-0.5 size-3.5 shrink-0 text-faint" />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-fg/90">{a.message}</div>
                    <div className="text-[11px] text-faint">{timeAgo(a.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Últimos prompts" action={<Link href="/library" className="text-xs text-muted hover:text-fg">Biblioteca →</Link>}>
          {data && data.prompts.length === 0 ? (
            <p className="text-xs text-faint">Nenhum prompt guardado. <Link href="/architect" className="text-accent hover:underline">Criar no Prompt Architect</Link>.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data?.prompts.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link href={`/library/${p.id}`} className="flex items-center gap-3 py-2.5 first:pt-0 hover:text-accent">
                    <PenTool className="size-3.5 text-faint" />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{p.title}</span>
                    {p.score !== undefined && <span className="text-xs tabular-nums text-muted">{p.score}</span>}
                    <Badge>v{p.version}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Ideias analisadas" action={<Link href="/analyzer" className="text-xs text-muted hover:text-fg">Analisar →</Link>}>
          {data && data.analyses.length === 0 ? (
            <p className="text-xs text-faint">Nenhuma ideia analisada ainda.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data?.analyses.slice(0, 5).map((a) => {
                const clarity = a.result.dimensions.find((d) => d.key === "clarity")?.score;
                return (
                  <li key={a.id}>
                    <Link href={`/analyzer?id=${a.id}`} className="flex items-center gap-3 py-2.5 first:pt-0 hover:text-accent">
                      <Lightbulb className="size-3.5 text-faint" />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{a.title}</span>
                      <span className="text-[11px] text-faint">clareza {clarity}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
