"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type WebsiteStats = {
  users: number;
  orders: number;
  revenue: number;
  pendingDirectOrders: number;
};

type WebsiteOrderRow = {
  id: number;
  auth_user_id: string | null;
  user_email: string | null;
  product_id: number;
  price: number;
  quantity: number;
  created_at: string;
  products?: {
    name: string;
    website_name?: string | null;
  }[] | null;
};

export default function WebsiteDashboardPage() {
  const [stats, setStats] = useState<WebsiteStats>({
    users: 0,
    orders: 0,
    revenue: 0,
    pendingDirectOrders: 0
  });
  const [orders, setOrders] = useState<WebsiteOrderRow[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setWarning(null);

      const [usersRes, ordersCountRes, ordersListRes, pendingDirectRes] = await Promise.all([
        supabase.from("website_users").select("id", { count: "exact", head: true }),
        supabase.from("website_orders").select("id", { count: "exact", head: true }),
        supabase
          .from("website_orders")
          .select("id, auth_user_id, user_email, product_id, price, quantity, created_at, products(name, website_name)")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("website_direct_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      ]);

      if (usersRes.error || ordersCountRes.error || ordersListRes.error || pendingDirectRes.error) {
        setWarning(
          "Thiếu bảng website_* hoặc chưa có quyền truy cập. Hãy chạy file SQL migration mới cho Website Dashboard."
        );
      }

      const revenueRowsRes = await supabase
        .from("website_orders")
        .select("price")
        .limit(5000);

      const revenueRows = (revenueRowsRes.data as Array<{ price: number | null }>) || [];
      const revenue = revenueRows.reduce((sum, row) => sum + Number(row.price || 0), 0);

      setStats({
        users: usersRes.count ?? 0,
        orders: ordersCountRes.count ?? 0,
        revenue,
        pendingDirectOrders: pendingDirectRes.count ?? 0
      });
      setOrders((ordersListRes.data as WebsiteOrderRow[]) || []);
    };

    load();
  }, []);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Website Dashboard</h1>
          <p className="muted">Report và giao dịch riêng cho Website.</p>
        </div>
        <div className="badge">Website Data</div>
      </div>

      {warning && (
        <div className="card">
          <p className="muted" style={{ color: "var(--danger)" }}>
            {warning}
          </p>
        </div>
      )}

      <div className="grid stats">
        <div className="card">
          <p className="muted">Người dùng Website</p>
          <h2>{stats.users.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">Đơn Website</p>
          <h2>{stats.orders.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">Doanh thu Website (VND)</p>
          <h2>{stats.revenue.toLocaleString("vi-VN")}</h2>
        </div>
        <div className="card">
          <p className="muted">Direct Orders chờ</p>
          <h2>{stats.pendingDirectOrders.toLocaleString("vi-VN")}</h2>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Giao dịch Website gần nhất</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
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
                <td>{order.user_email || order.auth_user_id || "-"}</td>
                <td>{order.products?.[0]?.website_name || order.products?.[0]?.name || `#${order.product_id}`}</td>
                <td>{order.quantity}</td>
                <td>{Number(order.price || 0).toLocaleString("vi-VN")}</td>
                <td>{order.created_at ? new Date(order.created_at).toLocaleString("vi-VN") : "-"}</td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={6} className="muted">
                  Chưa có giao dịch Website.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
