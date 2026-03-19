"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { performAdminFinanceAction } from "@/lib/adminFinanceClient";

interface Withdrawal {
  id: number;
  user_id: number;
  amount: number;
  momo_phone: string;
  status: string;
  created_at: string;
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("withdrawals")
      .select("id, user_id, amount, momo_phone, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setWithdrawals((data as Withdrawal[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmWithdrawal = async (withdrawal: Withdrawal) => {
    const nextActionKey = `confirm:${withdrawal.id}`;
    setActionKey(nextActionKey);
    setStatus(null);
    setStatusTone(null);
    try {
      await performAdminFinanceAction("withdrawal", "confirm", withdrawal.id);
      setStatus(`✅ Đã duyệt yêu cầu rút #${withdrawal.id}.`);
      setStatusTone("success");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể duyệt yêu cầu rút tiền.");
      setStatusTone("error");
    } finally {
      setActionKey(null);
    }
  };

  const cancelWithdrawal = async (withdrawal: Withdrawal) => {
    const nextActionKey = `cancel:${withdrawal.id}`;
    setActionKey(nextActionKey);
    setStatus(null);
    setStatusTone(null);
    try {
      await performAdminFinanceAction("withdrawal", "cancel", withdrawal.id);
      setStatus(`✅ Đã từ chối yêu cầu rút #${withdrawal.id}.`);
      setStatusTone("success");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể từ chối yêu cầu rút tiền.");
      setStatusTone("error");
    } finally {
      setActionKey(null);
    }
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Withdrawals</h1>
          <p className="muted">Duyệt các yêu cầu rút tiền.</p>
        </div>
      </div>

      <div className="card">
        {status && (
          <p
            className="muted"
            style={{
              marginBottom: 12,
              color: statusTone === "error" ? "var(--danger)" : "#20705b"
            }}
          >
            {status}
          </p>
        )}
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Số tiền</th>
              <th>Momo</th>
              <th>Thời gian</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((withdrawal) => (
              <tr key={withdrawal.id}>
                <td>#{withdrawal.id}</td>
                <td>{withdrawal.user_id}</td>
                <td>{withdrawal.amount.toLocaleString()}</td>
                <td>{withdrawal.momo_phone}</td>
                <td>{new Date(withdrawal.created_at).toLocaleString()}</td>
                <td>
                  <button
                    className="button"
                    disabled={actionKey === `confirm:${withdrawal.id}` || actionKey === `cancel:${withdrawal.id}`}
                    onClick={() => confirmWithdrawal(withdrawal)}
                  >
                    {actionKey === `confirm:${withdrawal.id}` ? "Đang duyệt..." : "Duyệt"}
                  </button>
                  <button
                    className="button secondary"
                    style={{ marginLeft: 8 }}
                    disabled={actionKey === `confirm:${withdrawal.id}` || actionKey === `cancel:${withdrawal.id}`}
                    onClick={() => cancelWithdrawal(withdrawal)}
                  >
                    {actionKey === `cancel:${withdrawal.id}` ? "Đang từ chối..." : "Từ chối"}
                  </button>
                </td>
              </tr>
            ))}
            {!withdrawals.length && (
              <tr>
                <td colSpan={6} className="muted">Không có yêu cầu pending.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
