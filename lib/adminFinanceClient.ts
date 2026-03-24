"use client";

import { supabase } from "@/lib/supabaseClient";

export type FinanceResource = "deposit" | "withdrawal" | "usdt_withdrawal";
export type FinanceAction = "confirm" | "cancel";

export async function performAdminFinanceAction(
  resource: FinanceResource,
  action: FinanceAction,
  recordId: number
) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Chưa đăng nhập.");
  }

  const response = await fetch("/api/admin-finance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      resource,
      action,
      recordId
    })
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof json?.error === "string" && json.error.trim()
        ? json.error
        : "Không thể xử lý yêu cầu."
    );
  }

  return json?.data ?? null;
}
