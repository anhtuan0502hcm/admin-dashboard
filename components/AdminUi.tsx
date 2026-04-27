"use client";

import { useState, type ReactNode } from "react";

/* ============================================================
   PageHeader
   ============================================================ */
export function PageHeader({
  title,
  description,
  actions,
  badge
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 className="page-title">{title}</h1>
          {badge && badge}
        </div>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* ============================================================
   StatusPill
   ============================================================ */
export function StatusPill({
  tone = "neutral",
  children
}: {
  tone?: "neutral" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

/* ============================================================
   StatCard
   ============================================================ */
export function StatCard({
  label,
  value,
  icon,
  glow = "green",
  trend,
  trendDir,
  sub
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  glow?: "green" | "blue" | "gold" | "red" | "purple";
  trend?: string;
  trendDir?: "up" | "down" | "neutral";
  sub?: ReactNode;
}) {
  const iconColor = { green: "green", blue: "blue", gold: "gold", red: "red", purple: "purple" }[glow];
  return (
    <div className={`stat-card glow-${glow}`}>
      <div className="stat-header">
        <p className="stat-label">{label}</p>
        {icon && <div className={`stat-icon ${iconColor}`}>{icon}</div>}
      </div>
      <div className="stat-value">{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        {trend && (
          <span className={`stat-trend ${trendDir ?? "neutral"}`}>
            {trendDir === "up" ? "↑" : trendDir === "down" ? "↓" : "–"} {trend}
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ============================================================
   EmptyState
   ============================================================ */
export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <p className="empty-state-title">{title}</p>
      {description && <p className="muted">{description}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

/* ============================================================
   SkeletonTable
   ============================================================ */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="skeleton skeleton-row"
              style={{ height: 38, opacity: 1 - r * 0.12 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   SkeletonStats
   ============================================================ */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-stat" />
      ))}
    </div>
  );
}

/* ============================================================
   IconButton
   ============================================================ */
export function IconButton({
  icon,
  label,
  onClick,
  tone,
  disabled
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  tone?: "danger" | "success";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${tone ?? ""}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </button>
  );
}

/* ============================================================
   RowActionMenu — compact row-level action dropdown
   ============================================================ */
export type RowActionMenuItem = {
  label: string;
  tone?: "danger" | "warning";
  disabled?: boolean;
  onSelect: () => void;
};

export function RowActionMenu({
  items,
  label = "Mở menu hành động"
}: {
  items: RowActionMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!items.length) {
    return <span className="muted">-</span>;
  }

  return (
    <div
      className={`action-menu${open ? " is-open" : ""}`}
      onBlur={(event) => {
        const nextFocus = event.relatedTarget as Node | null;
        if (!nextFocus || !event.currentTarget.contains(nextFocus)) {
          setOpen(false);
        }
      }}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="button secondary action-menu-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        ...
      </button>
      {open && (
        <div className="action-menu-list" role="menu">
          {items.map((item) => (
            <button
              className={`action-menu-item${item.tone ? ` ${item.tone}` : ""}`}
              disabled={item.disabled}
              key={item.label}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ConfirmDialog
   ============================================================ */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => !busy && onCancel()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="section-title">{title}</h3>
        {description && (
          <div className="muted" style={{ marginTop: 8 }}>
            {description}
          </div>
        )}
        <div className="modal-actions">
          <button
            className={`button ${tone === "danger" ? "danger" : ""}`}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Đang xử lý..." : confirmLabel}
          </button>
          <button className="button secondary" type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SectionCard — card with header inside
   ============================================================ */
export function SectionCard({
  title,
  actions,
  children,
  noPad
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  noPad?: boolean;
}) {
  return (
    <div className="card" style={noPad ? { padding: 0, overflow: "hidden" } : undefined}>
      {(title || actions) && (
        <div className="section-head" style={noPad ? { padding: "16px 20px 0" } : undefined}>
          {title && <h3 className="section-title" style={{ marginBottom: 0 }}>{title}</h3>}
          {actions && <div className="page-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ============================================================
   DataTable — thin wrapper for table-in-card
   ============================================================ */
export function DataTable({
  children,
  overflow = true
}: {
  children: ReactNode;
  overflow?: boolean;
}) {
  return (
    <div style={overflow ? { overflowX: "auto" } : undefined}>
      <table className="table">{children}</table>
    </div>
  );
}

/* ============================================================
   CopyButton — copy text to clipboard
   ============================================================ */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
  };
  return (
    <button
      type="button"
      className="button secondary"
      style={{ fontSize: 11, padding: "4px 10px", gap: 5 }}
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      {label}
    </button>
  );
}
