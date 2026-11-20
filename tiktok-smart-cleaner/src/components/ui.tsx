import type { ReactNode } from "react";
import { X } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-xl border border-ink-700 bg-ink-850/80 backdrop-blur", className)}>{children}</section>;
}

export function Button({
  variant = "ghost", className, ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v = {
    primary: "bg-accent text-ink-950 hover:bg-cyan-300 font-semibold",
    ghost: "border border-ink-600 bg-ink-800 text-zinc-200 hover:bg-ink-700",
    danger: "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  }[variant];
  return (
    <button
      {...p}
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40", v, className)}
    />
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="w-full max-w-md rounded-xl border border-ink-600 bg-ink-850 p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-zinc-400 hover:bg-ink-700"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
