"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, PageHeader, StatusPill } from "@/components/AdminUi";
import {
  fetchAdminAuditLogs,
  fetchAdminOpsHealth,
  type AdminAuditLogRow,
  type AdminOpsHealth
} from "@/lib/adminOpsClient";

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
};

const flattenChecks = (records: Record<string, boolean>) =>
  Object.entries(records || {}).map(([key, ok]) => ({ key, ok }));

export default function HealthPage() {
  const [health, setHealth] = useState<AdminOpsHealth | null>(null);
  const [logs, setLogs] = useState<AdminAuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextHealth, audit] = await Promise.all([
        fetchAdminOpsHealth(5),
        fetchAdminAuditLogs(30).catch(() => ({ logs: [] }))
      ]);
      setHealth(nextHealth);
      setLogs(audit.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải health snapshot.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const schemaChecks = useMemo(() => {
    if (!health) return [];
    return [
      ...flattenChecks(health.schema.tables).map((item) => ({ ...item, group: "Table" })),
      ...flattenChecks(health.schema.productColumns).map((item) => ({ ...item, group: "Product column" })),
      ...flattenChecks(health.schema.rpcs).map((item) => ({ ...item, group: "RPC" }))
    ];
  }, [health]);

  const queueRisk =
    health &&
    (health.queues.pendingDirectOrdersExpired > 0 ||
      health.queues.deliveryOutbox.failed > 0 ||
      health.queues.deliveryOutbox.retryDue > 0);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <PageHeader
        title="System Health"
        description="Kiểm tra schema, hàng chờ giao hàng, pending payment và audit log."
        actions={
          <button className="button secondary" type="button" onClick={load} disabled={loading}>
            Làm mới
          </button>
        }
      />

      {error && (
        <div className="card compact-card" style={{ borderColor: "rgba(194, 65, 58, 0.32)" }}>
          <p style={{ color: "var(--danger)" }}>{error}</p>
        </div>
      )}

      {health && (
        <>
          <div className="grid stats">
            <div className="card">
              <p className="muted">Direct pending</p>
              <h2>{health.queues.pendingDirectOrders.toLocaleString("vi-VN")}</h2>
              <StatusPill tone={health.queues.pendingDirectOrdersExpired > 0 ? "danger" : "success"}>
                {health.queues.pendingDirectOrdersExpired} quá hạn
              </StatusPill>
            </div>
            <div className="card">
              <p className="muted">Delivery outbox</p>
              <h2>{health.queues.deliveryOutbox.pending.toLocaleString("vi-VN")}</h2>
              <StatusPill tone={queueRisk ? "warning" : "success"}>
                {health.queues.deliveryOutbox.failed} failed / {health.queues.deliveryOutbox.retryDue} retry
              </StatusPill>
            </div>
            <div className="card">
              <p className="muted">Low stock</p>
              <h2>{health.stock.count.toLocaleString("vi-VN")}</h2>
              <StatusPill tone={health.stock.count > 0 ? "warning" : "success"}>
                {"ngưỡng <= "} {health.stock.threshold}
              </StatusPill>
            </div>
            <div className="card">
              <p className="muted">Finance pending</p>
              <h2>
                {(
                  health.queues.pendingDeposits +
                  health.queues.pendingWithdrawals +
                  health.queues.pendingUsdtWithdrawals
                ).toLocaleString("vi-VN")}
              </h2>
              <StatusPill tone="neutral">nạp/rút/USDT</StatusPill>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Schema checklist</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Nhóm</th>
                  <th>Hạng mục</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {schemaChecks.map((item) => (
                  <tr key={`${item.group}:${item.key}`}>
                    <td>{item.group}</td>
                    <td>{item.key}</td>
                    <td>
                      <StatusPill tone={item.ok ? "success" : "danger"}>{item.ok ? "OK" : "Thiếu"}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid stats">
            <div className="card">
              <h3 className="section-title">Payment settings</h3>
              <div className="grid" style={{ gap: 8 }}>
                {flattenChecks(health.settings).map((item) => (
                  <div key={item.key} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>{item.key}</span>
                    <StatusPill tone={item.ok ? "success" : "warning"}>{item.ok ? "Có" : "Thiếu"}</StatusPill>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="section-title">Low-stock preview</h3>
              {!health.stock.items.length ? (
                <EmptyState title="Stock ổn" description="Không có sản phẩm nào dưới ngưỡng." />
              ) : (
                <table className="table">
                  <tbody>
                    {health.stock.items.map((item) => (
                      <tr key={item.id}>
                        <td>#{item.id}</td>
                        <td>{item.name}</td>
                        <td>{item.availableStock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      <div className="card">
        <h3 className="section-title">Audit log gần đây</h3>
        {!logs.length ? (
          <EmptyState title="Chưa có audit log" description="Audit log sẽ xuất hiện sau khi apply SQL mới và có thao tác admin." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.created_at)}</td>
                  <td>{log.admin_email || log.admin_user_id || "-"}</td>
                  <td>{log.action}</td>
                  <td>
                    {log.entity_type || "-"} {log.entity_id ? `#${log.entity_id}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
