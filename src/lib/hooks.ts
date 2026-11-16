"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRepository, subscribe, DEFAULT_SETTINGS, type Repository } from "./data/repository";
import type { AppSettings } from "./types";

export function useRepo(): Repository {
  return getRepository();
}

/** Consulta reativa: volta a correr sempre que o repositório é alterado. */
export function useLive<T>(query: (repo: Repository) => Promise<T>, deps: unknown[] = []): { data: T | undefined; loading: boolean; error?: string } {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error?: string }>({ data: undefined, loading: true });
  const q = useRef(query);
  q.current = query;
  useEffect(() => {
    let alive = true;
    const run = () =>
      q.current(getRepository())
        .then((data) => alive && setState({ data, loading: false }))
        .catch((e: unknown) => alive && setState({ data: undefined, loading: false, error: e instanceof Error ? e.message : String(e) }));
    run();
    const unsub = subscribe(run);
    return () => { alive = false; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function useSettings(): [AppSettings, (patch: Partial<Omit<AppSettings, "id">>) => Promise<void>] {
  const { data } = useLive((r) => r.getSettings());
  const save = useCallback(async (patch: Partial<Omit<AppSettings, "id">>) => { await getRepository().saveSettings(patch); }, []);
  return [data ?? DEFAULT_SETTINGS, save];
}

export interface ProviderInfo { id: string; label: string; configured: boolean; model: string }

export function useAiStatus(): { providers: ProviderInfo[]; loading: boolean; error?: string } {
  const [s, set] = useState<{ providers: ProviderInfo[]; loading: boolean; error?: string }>({ providers: [], loading: true });
  useEffect(() => {
    fetch("/api/ai/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => set({ providers: j.providers, loading: false }))
      .catch(() => set({ providers: [], loading: false, error: "Servidor de IA indisponível (modo offline ou build estático)." }));
  }, []);
  return s;
}

/** Passagem de conteúdo entre páginas (ex.: Prompt Architect → Evaluator). */
const HANDOFF = "abps:handoff";
export function setHandoff(data: Record<string, unknown>) {
  try { sessionStorage.setItem(HANDOFF, JSON.stringify(data)); } catch { /* ignora */ }
}
export function takeHandoff<T = Record<string, unknown>>(): T | null {
  try {
    const v = sessionStorage.getItem(HANDOFF);
    if (!v) return null;
    sessionStorage.removeItem(HANDOFF);
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}
