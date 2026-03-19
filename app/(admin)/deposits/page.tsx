"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { performAdminFinanceAction } from "@/lib/adminFinanceClient";

interface Deposit {
  id: number;
  user_id: number;
  amount: number;
  code: string;
  status: string;
  created_at: string;
}

export default function DepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("deposits")
      .select("id, user_id, amount, code, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setDeposits((data as Deposit[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmDeposit = async (deposit: Deposit) => {
    const nextActionKey = `confirm:${deposit.id}`;
    setActionKey(nextActionKey);
    setStatus(null);
    setStatusTone(null);
    try {
      await performAdminFinanceAction("deposit", "confirm", deposit.id);
      setStatus(`✅ Đã duyệt yêu cầu nạp #${deposit.id}.`);
      setStatusTone("success");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể duyệt yêu cầu nạp tiền.");
      setStatusTone("error");
    } finally {
      setActionKey(null);
    }
  };

  const cancelDeposit = async (deposit: Deposit) => {
    const nextActionKey = `cancel:${deposit.id}`;
    setActionKey(nextActionKey);
    setStatus(null);
    setStatusTone(null);
    try {
      await performAdminFinanceAction("deposit", "cancel", deposit.id);
      setStatus(`✅ Đã từ chối yêu cầu nạp #${deposit.id}.`);
      setStatusTone("success");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể từ chối yêu cầu nạp tiền.");
      setStatusTone("error");
    } finally {
      setActionKey(null);
    }
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Deposits</h1>
          <p className="muted">Duyệt các yêu cầu nạp tiền.</p>
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
              <th>Mã</th>
              <th>Thời gian</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((deposit) => (
              <tr key={deposit.id}>
                <td>#{deposit.id}</td>
                <td>{deposit.user_id}</td>
                <td>{deposit.amount.toLocaleString()}</td>
                <td>{deposit.code}</td>
                <td>{new Date(deposit.created_at).toLocaleString()}</td>
                <td>
                  <button
                    className="button"
                    disabled={actionKey === `confirm:${deposit.id}` || actionKey === `cancel:${deposit.id}`}
                    onClick={() => confirmDeposit(deposit)}
                  >
                    {actionKey === `confirm:${deposit.id}` ? "Đang duyệt..." : "Duyệt"}
                  </button>
                  <button
                    className="button secondary"
                    style={{ marginLeft: 8 }}
                    disabled={actionKey === `confirm:${deposit.id}` || actionKey === `cancel:${deposit.id}`}
                    onClick={() => cancelDeposit(deposit)}
                  >
                    {actionKey === `cancel:${deposit.id}` ? "Đang từ chối..." : "Từ chối"}
                  </button>
                </td>
              </tr>
            ))}
            {!deposits.length && (
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
