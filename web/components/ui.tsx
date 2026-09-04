"use client";

import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  icon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "attention" | "info" | "neutral" | "danger";
  children: ReactNode;
}) {
  return (
    <span className={`status-badge status-${tone}`}>
      <span className="status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export function Tabs({
  label,
  items,
}: {
  label: string;
  items: {
    id: string;
    label: string;
    active?: boolean;
    onSelect: () => void;
  }[];
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          className={`tab ${item.active ? "tab-active" : ""}`}
          type="button"
          role="tab"
          aria-selected={Boolean(item.active)}
          key={item.id}
          onClick={item.onSelect}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function DataTable({
  caption,
  columns,
  rows,
  emptyMessage = "No records found.",
}: {
  caption: string;
  columns: { key: string; label: string }[];
  rows: { id: string; cells: Record<string, ReactNode> }[];
  emptyMessage?: string;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th scope="col" key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>{row.cells[column.key]}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="table-empty" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="drawer-layer">
      <button
        className="drawer-backdrop"
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
      />
      <section
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="drawer-header">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            autoFocus
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="drawer-content">{children}</div>
      </section>
    </div>
  );
}
