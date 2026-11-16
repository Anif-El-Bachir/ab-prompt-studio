"use client";

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong font-medium",
  secondary: "bg-raised text-fg border border-line hover:border-line-strong hover:bg-[#1c1c20]",
  ghost: "text-muted hover:text-fg hover:bg-raised",
  danger: "bg-transparent text-bad border border-bad/40 hover:bg-bad/10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean; icon?: ReactNode }>(
  function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cx(
          "inline-flex items-center justify-center gap-2 rounded-lg transition-colors duration-150 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap",
          size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
          VARIANTS[variant],
          className,
        )}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
        {children}
      </button>
    );
  },
);

export function Card({ className, children, title, action, subtitle }: { className?: string; children: ReactNode; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("min-w-0 rounded-[var(--radius-card)] border border-line bg-surface animate-fade-in", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-medium tracking-wide text-fg">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx(title || action ? "px-5 pb-5" : "p-5")}>{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "warn" | "bad" | "info"; className?: string }) {
  const tones = {
    neutral: "border-line text-muted",
    accent: "border-accent/30 text-accent",
    ok: "border-ok/30 text-ok",
    warn: "border-warn/30 text-warn",
    bad: "border-bad/30 text-bad",
    info: "border-info/30 text-info",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-none whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

const field = "w-full rounded-lg border border-line bg-bg px-3 text-sm text-fg placeholder:text-faint transition-colors hover:border-line-strong focus:border-accent/60 focus:outline-none";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(field, "h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(field, "py-2.5 leading-relaxed", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(field, "h-10 pr-8 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238d8d96%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-[right_10px_center]", className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children, htmlFor, error }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted">{label}</label>
      {children}
      {error ? <p className="text-xs text-bad" role="alert">{error}</p> : hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="text-sm text-fg">{title}</p>
      {text && <p className="mt-1 max-w-sm text-xs text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function scoreTone(score: number, inverted = false): "ok" | "warn" | "bad" {
  const s = inverted ? 100 - score : score;
  return s >= 70 ? "ok" : s >= 45 ? "warn" : "bad";
}

export function ScoreBar({ score, inverted, muted }: { score: number; inverted?: boolean; muted?: boolean }) {
  const tone = scoreTone(score, inverted);
  const color = muted ? "bg-faint" : tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-bad";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-[width] duration-700", color)} style={{ width: `${score}%` }} />
    </div>
  );
}

export function ScoreRing({ score, size = 72, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const tone = scoreTone(score);
  const stroke = tone === "ok" ? "var(--color-ok)" : tone === "warn" ? "var(--color-warn)" : "var(--color-bad)";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth={5} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-semibold tabular-nums leading-none">{score}</div>
        {label && <div className="mt-0.5 text-[10px] text-muted">{label}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-bg p-1">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cx("rounded-md px-3 py-1.5 text-[13px] transition-colors", value === it.value ? "bg-raised text-fg" : "text-muted hover:text-fg")}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{children}</h3>;
}
