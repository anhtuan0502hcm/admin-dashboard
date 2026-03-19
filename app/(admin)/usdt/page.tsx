"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { performAdminFinanceAction } from "@/lib/adminFinanceClient";

interface BinanceDeposit {
  id: number;
  user_id: number;
  usdt_amount: number;
  vnd_amount: number;
  code: string;
  screenshot_file_id: string | null;
  status: string;
  created_at: string;
}

interface UsdtWithdrawal {
  id: number;
  user_id: number;
  usdt_amount: number;
  wallet_address: string;
  network: string;
  status: string;
  created_at: string;
}

export default function UsdtPage() {
  const [binanceDeposits, setBinanceDeposits] = useState<BinanceDeposit[]>([]);
  const [usdtWithdrawals, setUsdtWithdrawals] = useState<UsdtWithdrawal[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const load = async () => {
    const { data: deposits } = await supabase
      .from("binance_deposits")
      .select("id, user_id, usdt_amount, vnd_amount, code, screenshot_file_id, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setBinanceDeposits((deposits as BinanceDeposit[]) || []);

    const { data: withdrawals } = await supabase
      .from("usdt_withdrawals")
      .select("id, user_id, usdt_amount, wallet_address, network, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setUsdtWithdrawals((withdrawals as UsdtWithdrawal[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmBinance = async (deposit: BinanceDeposit) => {
    const nextActionKey = `binance_confirm:${deposit.id}`;
    setActionKey(nextActionKey);
    setStatus(null);
    setStatusTone(null);
    try {
      await performAdminFinanceAction("binance_deposit", "confirm", deposit.id);
      setStatus(`✅ Đã duyệt yêu cầu nạp USDT #${deposit.id}.`);
      setStatusTone("success");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể duyệt yêu cầu nạp USDT.");
      setStatusTone("error");
    } finally {
      setActionKey(null);
    }
  };

  const cancelBinance = async (deposit: BinanceDeposit) => {
    const nextActionKey = `binance_cancel:${deposit.id}`;
    setActionKey(nextActionKey);
    setStatus(null);
    setStatusTone(null);
    try {
      await performAdminFinanceAction("binance_deposit", "cancel", deposit.id);
      setStatus(`✅ Đã từ chối yêu cầu nạp USDT #${deposit.id}.`);
      setStatusTone("success");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể từ chối yêu cầu nạp USDT.");
      setStatusTone("error");
    } finally {
      setActionKey(null);
    }
  };

  const confirmUsdtWithdrawal = async (withdrawal: UsdtWithdrawal) => {
    const nextActionKey = `withdraw_confirm:${withdrawal.id}`;
    setActionKey(nextActionKey);
    setStatus(null);
    setStatusTone(null);
    try {
      await performAdminFinanceAction("usdt_withdrawal", "confirm", withdrawal.id);
      setStatus(`✅ Đã duyệt yêu cầu rút USDT #${withdrawal.id}.`);
      setStatusTone("success");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể duyệt yêu cầu rút USDT.");
      setStatusTone("error");
    } finally {
      setActionKey(null);
    }
  };

  const cancelUsdtWithdrawal = async (withdrawal: UsdtWithdrawal) => {
    const nextActionKey = `withdraw_cancel:${withdrawal.id}`;
    setActionKey(nextActionKey);
    setStatus(null);
    setStatusTone(null);
    try {
      await performAdminFinanceAction("usdt_withdrawal", "cancel", withdrawal.id);
      setStatus(`✅ Đã từ chối yêu cầu rút USDT #${withdrawal.id}.`);
      setStatusTone("success");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể từ chối yêu cầu rút USDT.");
      setStatusTone("error");
    } finally {
      setActionKey(null);
    }
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">USDT</h1>
          <p className="muted">Duyệt nạp USDT và rút USDT.</p>
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
        <h3 className="section-title">Nạp USDT (Binance)</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>USDT</th>
              <th>VND</th>
              <th>Code</th>
              <th>Time</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {binanceDeposits.map((deposit) => (
              <tr key={deposit.id}>
                <td>#{deposit.id}</td>
                <td>{deposit.user_id}</td>
                <td>{deposit.usdt_amount}</td>
                <td>{deposit.vnd_amount.toLocaleString()}</td>
                <td>{deposit.code}</td>
                <td>{new Date(deposit.created_at).toLocaleString()}</td>
                <td>
                  <button
                    className="button"
                    disabled={actionKey === `binance_confirm:${deposit.id}` || actionKey === `binance_cancel:${deposit.id}`}
                    onClick={() => confirmBinance(deposit)}
                  >
                    {actionKey === `binance_confirm:${deposit.id}` ? "Đang duyệt..." : "Duyệt"}
                  </button>
                  <button
                    className="button secondary"
                    style={{ marginLeft: 8 }}
                    disabled={actionKey === `binance_confirm:${deposit.id}` || actionKey === `binance_cancel:${deposit.id}`}
                    onClick={() => cancelBinance(deposit)}
                  >
                    {actionKey === `binance_cancel:${deposit.id}` ? "Đang từ chối..." : "Từ chối"}
                  </button>
                </td>
              </tr>
            ))}
            {!binanceDeposits.length && (
              <tr>
                <td colSpan={7} className="muted">Không có yêu cầu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="section-title">Rút USDT</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>USDT</th>
              <th>Wallet</th>
              <th>Network</th>
              <th>Time</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {usdtWithdrawals.map((withdrawal) => (
              <tr key={withdrawal.id}>
                <td>#{withdrawal.id}</td>
                <td>{withdrawal.user_id}</td>
                <td>{withdrawal.usdt_amount}</td>
                <td>{withdrawal.wallet_address}</td>
                <td>{withdrawal.network}</td>
                <td>{new Date(withdrawal.created_at).toLocaleString()}</td>
                <td>
                  <button
                    className="button"
                    disabled={actionKey === `withdraw_confirm:${withdrawal.id}` || actionKey === `withdraw_cancel:${withdrawal.id}`}
                    onClick={() => confirmUsdtWithdrawal(withdrawal)}
                  >
                    {actionKey === `withdraw_confirm:${withdrawal.id}` ? "Đang duyệt..." : "Duyệt"}
                  </button>
                  <button
                    className="button secondary"
                    style={{ marginLeft: 8 }}
                    disabled={actionKey === `withdraw_confirm:${withdrawal.id}` || actionKey === `withdraw_cancel:${withdrawal.id}`}
                    onClick={() => cancelUsdtWithdrawal(withdrawal)}
                  >
                    {actionKey === `withdraw_cancel:${withdrawal.id}` ? "Đang từ chối..." : "Từ chối"}
                  </button>
                </td>
              </tr>
            ))}
            {!usdtWithdrawals.length && (
              <tr>
                <td colSpan={7} className="muted">Không có yêu cầu.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
