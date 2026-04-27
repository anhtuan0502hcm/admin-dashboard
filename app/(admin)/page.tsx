"use client";

import { useEffect, useState } from "react";
import {
  fetchDashboardSnapshot,
  type DashboardOrderRow,
  type DashboardSnapshot,
  type DashboardStats
} from "@/lib/adminAnalyticsClient";
import { PageHeader, StatusPill } from "@/components/AdminUi";
import { fetchAdminOpsHealth, type AdminOpsHealth } from "@/lib/adminOpsClient";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ users: 0, orders: 0, revenue: 0 });
  const [orders, setOrders] = useState<DashboardOrderRow[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState(0);
  const [health, setHealth] = useState<AdminOpsHealth | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = async () => {
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
  };

  useEffect(() => {
    loadDashboard().catch((error) => {
      setLoadError(error instanceof Error ? error.message : "Không thể tải Dashboard.");
    });
  }, []);

  const formatDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(date);
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <PageHeader
        title="Tổng quan"
        description="Tổng quan hiệu suất shop và trạng thái vận hành Bot."
        actions={<div className="badge">Live Supabase</div>}
      />

      {loadError && (
        <div className="card" style={{ border: "1px solid #b91c1c" }}>
          <p style={{ color: "#b91c1c", marginBottom: 12 }}>{loadError}</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              loadDashboard().catch((error) => {
                setLoadError(error instanceof Error ? error.message : "Không thể tải Dashboard.");
              });
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="grid stats">
        <div className="card">
          <p className="muted">Người dùng</p>
          <h2>{stats.users}</h2>
        </div>
        <div className="card">
          <p className="muted">Đơn hàng</p>
          <h2>{stats.orders}</h2>
        </div>
        <div className="card">
          <p className="muted">Doanh thu (VND)</p>
          <h2>{stats.revenue.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">Đang chờ</p>
          <h2>
            {pendingDeposits} nạp / {pendingWithdrawals} rút
          </h2>
        </div>
      </div>

      {health && (
        <div className="grid stats">
          <div className="card compact-card">
            <p className="muted">Direct quá hạn</p>
            <h2>{health.queues.pendingDirectOrdersExpired}</h2>
            <StatusPill tone={health.queues.pendingDirectOrdersExpired ? "danger" : "success"}>
              pending payment
            </StatusPill>
          </div>
          <div className="card compact-card">
            <p className="muted">Outbox lỗi</p>
            <h2>{health.queues.deliveryOutbox.failed}</h2>
            <StatusPill tone={health.queues.deliveryOutbox.failed ? "danger" : "success"}>
              delivery
            </StatusPill>
          </div>
          <div className="card compact-card">
            <p className="muted">Low stock</p>
            <h2>{health.stock.count}</h2>
            <StatusPill tone={health.stock.count ? "warning" : "success"}>
              {"ngưỡng <= "} {health.stock.threshold}
            </StatusPill>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="section-title">Đơn hàng gần nhất</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>UserID</th>
              <th>Username</th>
              <th>Tên người dùng</th>
              <th>Sản phẩm</th>
              <th>SL</th>
              <th>Giá</th>
              <th>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>#{order.id}</td>
                <td>{order.user_id}</td>
                <td>{order.username || "-"}</td>
                <td>{order.display_name || "-"}</td>
                <td>{order.product_name || order.product_id}</td>
                <td>{order.quantity}</td>
                <td>{order.price.toLocaleString("vi-VN")}</td>
                <td>{formatDateTime(order.created_at)}</td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={8} className="muted">
                  Chưa có đơn hàng.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
