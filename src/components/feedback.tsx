"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, X } from "lucide-react";
import { Button, cx } from "./ui";

/* ---------- Toasts ---------- */

type Toast = { id: number; text: string; tone: "ok" | "bad" | "info" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "bad" ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-32px))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto animate-fade-in rounded-lg border bg-raised px-4 py-3 text-sm shadow-2xl shadow-black/50", t.tone === "bad" ? "border-bad/40 text-bad" : t.tone === "info" ? "border-line text-fg" : "border-ok/30 text-fg")}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------- Diálogo de confirmação / modal ---------- */

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={cx("m-auto w-[calc(100vw-32px)] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-fg shadow-2xl shadow-black/60", wide ? "max-w-3xl" : "max-w-md")}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-medium">{title}</h2>
            <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-raised hover:text-fg" aria-label="Fechar"><X className="size-4" /></button>
          </header>
          <div className="overflow-y-auto px-5 py-4 text-sm">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, onCancel, onConfirm, title, text, confirmLabel = "Confirmar", danger }: { open: boolean; onCancel: () => void; onConfirm: () => void; title: string; text: ReactNode; confirmLabel?: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} footer={<><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div className="flex gap-3 text-muted">
        {danger && <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" />}
        <div>{text}</div>
      </div>
    </Modal>
  );
}

/* ---------- Copiar ---------- */

export function CopyButton({ text, label = "Copiar", size = "sm", variant = "secondary" }: { text: string; label?: string; size?: "sm" | "md"; variant?: "primary" | "secondary" | "ghost" }) {
  const [done, setDone] = useState(false);
  const toast = useToast();
  return (
    <Button
      size={size}
      variant={variant}
      disabled={!text}
      icon={done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          toast("Não foi possível copiar. Seleciona o texto e usa Ctrl+C.", "bad");
        }
      }}
    >
      {done ? "Copiado" : label}
    </Button>
  );
}
