"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface OrderRow {
  id: number | string;
  user_id: number | string;
  product_id: number | string;
  price: number;
  quantity: number;
  created_at: string;
}

export default function OrdersPage() {
  const PAGE_SIZE = 50;
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [usernamesByUserId, setUsernamesByUserId] = useState<Record<string, string | null>>({});
  const [productNamesById, setProductNamesById] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const load = async (pageIndex: number) => {
    const from = (pageIndex - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from("orders")
      .select("id, user_id, product_id, price, quantity, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    const rows = (data as OrderRow[]) || [];
    setOrders(rows);
    setTotalCount(count ?? 0);

    const userIds = Array.from(
      new Set(
        rows
          .map((order) => order.user_id)
          .filter((value): value is number | string => value !== null && value !== undefined)
          .map(String)
      )
    );
    const productIds = Array.from(
      new Set(
        rows
          .map((order) => order.product_id)
          .filter((value): value is number | string => value !== null && value !== undefined)
          .map(String)
      )
    );

    const [usersRes, productsRes] = await Promise.all([
      userIds.length
        ? supabase.from("users").select("user_id, username").in("user_id", userIds)
        : Promise.resolve({ data: [] as Array<{ user_id: number | string; username: string | null }> }),
      productIds.length
        ? supabase.from("products").select("id, name").in("id", productIds)
        : Promise.resolve({ data: [] as Array<{ id: number | string; name: string }> })
    ]);

    const usernames: Record<string, string | null> = {};
    for (const user of usersRes.data ?? []) {
      if (user?.user_id === null || user?.user_id === undefined) continue;
      usernames[String(user.user_id)] = user.username ?? null;
    }
    setUsernamesByUserId(usernames);

    const productNames: Record<string, string> = {};
    for (const product of productsRes.data ?? []) {
      if (product?.id === null || product?.id === undefined) continue;
      productNames[String(product.id)] = product.name;
    }
    setProductNamesById(productNames);
  };

  useEffect(() => {
    load(page).catch(() => null);
  }, [page]);

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
      <div className="topbar">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="muted">Theo dõi đơn hàng gần nhất.</p>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Danh sách đơn hàng</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>UserID</th>
              <th>Username</th>
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
                <td>{usernamesByUserId[String(order.user_id)] || "-"}</td>
                <td>{productNamesById[String(order.product_id)] || order.product_id}</td>
                <td>{order.quantity}</td>
                <td>{order.price.toLocaleString("vi-VN")}</td>
                <td>{formatDateTime(order.created_at)}</td>
              </tr>
            ))}
            {!orders.length && (
              <tr>
                <td colSpan={7} className="muted">Chưa có đơn hàng.</td>
              </tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage(Math.max(1, page - 1))}
            >
              Trang trước
            </button>
            <span className="muted">
              Trang {page}/{totalPages} · Tổng {totalCount.toLocaleString("vi-VN")}
            </span>
            <button
              className="button secondary"
              disabled={page === totalPages}
              onClick={() => setPage(Math.min(totalPages, page + 1))}
            >
              Trang sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
