import type { ReactNode } from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger"; icon?: ReactNode };

export function Button({ variant = "primary", icon, className = "", children, ...props }: ButtonProps) {
  return <button className={`button button-${variant} ${className}`} {...props}>{icon}{children}</button>;
}

export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return <label className="field"><span className="field-label">{label} {required ? <span aria-hidden="true">*</span> : null}</span>{children}{hint ? <span className="field-hint">{hint}</span> : null}</label>;
}

export function StatusBadge({ tone, children }: { tone: "success" | "attention" | "info" | "neutral" | "danger"; children: ReactNode }) {
  return <span className={`status-badge status-${tone}`}><span className="status-dot" aria-hidden="true" />{children}</span>;
}