"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface WebsiteDirectOrderRow {
  id: number;
  auth_user_id: string | null;
  user_email: string | null;
  product_id: number;
  quantity: number;
  bonus_quantity: number;
  unit_price: number;
  amount: number;
  code: string;
  status: string;
  created_at: string;
  products?: {
    name: string;
    website_name?: string | null;
  }[] | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  confirmed: "Đã duyệt",
  failed: "Thất bại",
  cancelled: "Đã hủy"
};

export default function WebsiteDirectOrdersPage() {
  const [orders, setOrders] = useState<WebsiteDirectOrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    let query = supabase
      .from("website_direct_orders")
      .select(
        "id, auth_user_id, user_email, product_id, quantity, bonus_quantity, unit_price, amount, code, status, created_at, products(name, website_name)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      setStatus("Thiếu bảng website_direct_orders hoặc chưa cấp quyền. Hãy chạy SQL migration mới.");
      setOrders([]);
      return;
    }
    setOrders((data as WebsiteDirectOrderRow[]) || []);
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const filtered = useMemo(() => orders, [orders]);

  const updateStatus = async (orderId: number, nextStatus: "failed" | "cancelled") => {
    if (!confirm(`Cập nhật đơn #${orderId} thành "${nextStatus}"?`)) return;
    setProcessingId(orderId);
    const { error } = await supabase
      .from("website_direct_orders")
      .update({ status: nextStatus })
      .eq("id", orderId)
      .eq("status", "pending");
    setProcessingId(null);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus(`Đã cập nhật đơn #${orderId} -> ${nextStatus}.`);
    await load();
  };

  const handleApprove = async (orderId: number) => {
    if (!confirm(`Duyệt đơn Website #${orderId} và xuất hàng từ kho?`)) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setStatus("Chưa đăng nhập.");
      return;
    }
    setProcessingId(orderId);
    setStatus(null);
    try {
      const res = await fetch("/api/website-direct-orders/fulfill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });
      const payload = await res.json();
      if (!res.ok) {
        setStatus(payload.error || "Duyệt đơn thất bại.");
        return;
      }
      setStatus(`✅ Đã duyệt đơn Website #${orderId}.`);
      await load();
    } catch {
      setStatus("Duyệt đơn thất bại.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Website Direct Orders</h1>
          <p className="muted">Đơn chuyển khoản trực tiếp riêng của Website.</p>
        </div>
      </div>

      <div className="card">
        <div className="form-grid">
          <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="pending">Chờ xử lý</option>
            <option value="confirmed">Đã duyệt</option>
            <option value="failed">Thất bại</option>
            <option value="cancelled">Đã hủy</option>
            <option value="all">Tất cả</option>
          </select>
        </div>
        {status && (
          <p className="muted" style={{ marginTop: 8 }}>
            {status}
          </p>
        )}
      </div>

      <div className="card">
        <h3 className="section-title">Danh sách direct orders Website</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Amount</th>
              <th>Code</th>
              <th>Status</th>
              <th>Time</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id}>
                <td>#{order.id}</td>
                <td>{order.user_email || order.auth_user_id || "-"}</td>
                <td>{order.products?.[0]?.website_name || order.products?.[0]?.name || `#${order.product_id}`}</td>
                <td>
                  {order.quantity}
                  {order.bonus_quantity > 0 ? ` +${order.bonus_quantity}` : ""}
                </td>
                <td>{Number(order.amount || 0).toLocaleString("vi-VN")}</td>
                <td>{order.code}</td>
                <td>{STATUS_LABELS[order.status] ?? order.status}</td>
                <td>{order.created_at ? new Date(order.created_at).toLocaleString("vi-VN") : "-"}</td>
                <td>
                  {order.status === "pending" ? (
                    <div className="table-actions">
                      <button
                        className="button secondary"
                        disabled={processingId === order.id}
                        onClick={() => handleApprove(order.id)}
                      >
                        Duyệt
                      </button>
                      <button
                        className="button danger"
                        disabled={processingId === order.id}
                        onClick={() => updateStatus(order.id, "failed")}
                      >
                        Thất bại
                      </button>
                    </div>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={9} className="muted">
                  Chưa có direct order Website.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
