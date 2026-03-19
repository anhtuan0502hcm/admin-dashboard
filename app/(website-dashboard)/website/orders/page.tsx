"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface WebsiteOrderRow {
  id: number;
  auth_user_id: string | null;
  user_email: string | null;
  product_id: number;
  content: string | null;
  price: number;
  quantity: number;
  created_at: string;
  products?: {
    name: string;
    website_name?: string | null;
  }[] | null;
}

export default function WebsiteOrdersPage() {
  const [orders, setOrders] = useState<WebsiteOrderRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("website_orders")
      .select("id, auth_user_id, user_email, product_id, content, price, quantity, created_at, products(name, website_name)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setMessage("Thiếu bảng website_orders hoặc chưa cấp quyền. Hãy chạy SQL migration mới.");
      setOrders([]);
      return;
    }

    setMessage(null);
    setOrders((data as WebsiteOrderRow[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Website Orders</h1>
          <p className="muted">Đơn hàng riêng của Website (tách biệt với Bot Telegram).</p>
        </div>
      </div>

      {message && (
        <div className="card">
          <p className="muted" style={{ color: "var(--danger)" }}>
            {message}
          </p>
        </div>
      )}

      <div className="card">
        <h3 className="section-title">Danh sách đơn hàng Website</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Sản phẩm</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Time</th>
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
                  Chưa có đơn hàng Website.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
