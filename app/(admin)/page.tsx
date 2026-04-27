"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchDashboardSnapshot,
  type DashboardOrderRow,
  type DashboardSnapshot,
  type DashboardStats
} from "@/lib/adminAnalyticsClient";
import { PageHeader, StatCard, StatusPill, SectionCard, DataTable, EmptyState, SkeletonStats, SkeletonTable } from "@/components/AdminUi";
import { fetchAdminOpsHealth, type AdminOpsHealth } from "@/lib/adminOpsClient";

/* ── Icons ──────────────────────────────────────────────────── */
const IcoUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IcoOrders = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const IcoRevenue = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const IcoPending = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IcoAlert = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IcoBox = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
  </svg>
);
const IcoRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

/* ── Helpers ────────────────────────────────────────────────── */
const fmtVND = (n: number) => n.toLocaleString("vi-VN") + "₫";
const fmtNum = (n: number) => n.toLocaleString("vi-VN");

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(d);
}

function shortId(id: number | string) {
  const s = String(id);
  return s.length > 8 ? `…${s.slice(-6)}` : s;
}

/* ── Component ──────────────────────────────────────────────── */
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ users: 0, orders: 0, revenue: 0 });
  const [orders, setOrders] = useState<DashboardOrderRow[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [health, setHealth] = useState<AdminOpsHealth | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [snapshot, healthSnapshot]: [DashboardSnapshot, AdminOpsHealth | null] = await Promise.all([
        fetchDashboardSnapshot(),
        fetchAdminOpsHealth(5).catch(() => null)
      ]);
      setStats(snapshot.stats);
      setOrders(snapshot.orders);
      setPendingDeposits(snapshot.pendingDeposits);
      setPendingWithdrawals(snapshot.pendingWithdrawals);
      setHealth(healthSnapshot);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Không thể tải Dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const totalPending = pendingDeposits + pendingWithdrawals;

  return (
    <div className="grid" style={{ gap: 28 }}>
      {/* ── Header ── */}
      <PageHeader
        title="Tổng quan"
        description="Snapshot vận hành Bot và hiệu suất shop theo thời gian thực."
        badge={
          <span className="badge" style={{ fontSize: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3fb950", display: "inline-block" }} />
            Live
          </span>
        }
        actions={
          <button
            className="button secondary"
            style={{ gap: 6, fontSize: 12 }}
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            title="Làm mới dữ liệu"
          >
            <span className={refreshing ? "spin" : ""}><IcoRefresh /></span>
            {refreshing ? "Đang tải…" : "Làm mới"}
          </button>
        }
      />

      {/* ── Error ── */}
      {loadError && (
        <div className="card" style={{ border: "1px solid rgba(248,81,73,0.3)", background: "rgba(248,81,73,0.06)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ color: "var(--danger)", fontSize: 20 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)", marginBottom: 6 }}>Lỗi tải dữ liệu</div>
              <p className="muted">{loadError}</p>
            </div>
            <button className="button secondary" style={{ fontSize: 12 }} onClick={() => loadDashboard()}>Thử lại</button>
          </div>
        </div>
      )}

      {/* ── Primary Stats ── */}
      {loading ? (
        <div className="grid stats"><div className="skeleton skeleton-stat" /><div className="skeleton skeleton-stat" /><div className="skeleton skeleton-stat" /><div className="skeleton skeleton-stat" /></div>
      ) : (
        <div className="grid stats">
          <StatCard
            label="Người dùng"
            value={fmtNum(stats.users)}
            icon={<IcoUsers />}
            glow="blue"
          />
          <StatCard
            label="Đơn hàng"
            value={fmtNum(stats.orders)}
            icon={<IcoOrders />}
            glow="green"
          />
          <StatCard
            label="Doanh thu"
            value={fmtVND(stats.revenue)}
            icon={<IcoRevenue />}
            glow="gold"
          />
          <StatCard
            label="Chờ duyệt"
            value={totalPending}
            icon={<IcoPending />}
            glow={totalPending > 0 ? "red" : "green"}
            sub={totalPending > 0 ? `${pendingDeposits} nạp · ${pendingWithdrawals} rút` : "Không có gì pending"}
          />
        </div>
      )}

      {/* ── Health Cards ── */}
      {health && (
        <div className="grid stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div className="stat-card" style={{ gap: 8 }}>
            <div className="stat-header">
              <p className="stat-label">Direct quá hạn</p>
              <div className={`stat-icon ${health.queues.pendingDirectOrdersExpired > 0 ? "red" : "green"}`}>
                <IcoAlert />
              </div>
            </div>
            <div className="stat-value" style={{ fontSize: 22 }}>
              {health.queues.pendingDirectOrdersExpired}
            </div>
            <StatusPill tone={health.queues.pendingDirectOrdersExpired > 0 ? "danger" : "success"}>
              {health.queues.pendingDirectOrdersExpired > 0 ? "Cần xử lý" : "Ổn định"}
            </StatusPill>
          </div>

          <div className="stat-card" style={{ gap: 8 }}>
            <div className="stat-header">
              <p className="stat-label">Outbox lỗi</p>
              <div className={`stat-icon ${health.queues.deliveryOutbox.failed > 0 ? "red" : "green"}`}>
                <IcoBox />
              </div>
            </div>
            <div className="stat-value" style={{ fontSize: 22 }}>
              {health.queues.deliveryOutbox.failed}
            </div>
            <StatusPill tone={health.queues.deliveryOutbox.failed > 0 ? "danger" : "success"}>
              {health.queues.deliveryOutbox.failed > 0 ? "Failed delivery" : "Giao hàng OK"}
            </StatusPill>
          </div>

          <div className="stat-card" style={{ gap: 8 }}>
            <div className="stat-header">
              <p className="stat-label">Low stock</p>
              <div className={`stat-icon ${health.stock.count > 0 ? "gold" : "green"}`}>
                <IcoBox />
              </div>
            </div>
            <div className="stat-value" style={{ fontSize: 22 }}>
              {health.stock.count}
            </div>
            <StatusPill tone={health.stock.count > 0 ? "warning" : "success"}>
              ngưỡng ≤ {health.stock.threshold}
            </StatusPill>
          </div>
        </div>
      )}

      {/* ── Recent Orders ── */}
      <SectionCard
        title="Đơn hàng gần nhất"
        noPad
        actions={
          orders.length > 0 ? (
            <span className="chip">{orders.length} đơn</span>
          ) : undefined
        }
      >
        {loading ? (
          <div style={{ padding: "16px 20px" }}><SkeletonTable rows={5} cols={6} /></div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState icon="📭" title="Chưa có đơn hàng" description="Đơn hàng sẽ xuất hiện ở đây khi có giao dịch mới." />
          </div>
        ) : (
          <DataTable>
            <thead>
              <tr>
                <th>ID</th>
                <th>Người dùng</th>
                <th>Sản phẩm</th>
                <th style={{ textAlign: "right" }}>SL</th>
                <th style={{ textAlign: "right" }}>Giá</th>
                <th style={{ textAlign: "right" }}>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span className="data-tag">#{shortId(order.id)}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                        {order.display_name || order.username || "–"}
                      </span>
                      {order.username && (
                        <span className="muted" style={{ fontSize: 11 }}>@{order.username}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 13 }} className="cell-truncate">
                      {order.product_name || order.product_id}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="chip">{order.quantity}</span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--success)", fontSize: 13 }}>
                    {order.price.toLocaleString("vi-VN")}₫
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                      {formatDateTime(order.created_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </SectionCard>
    </div>
  );
}
