"use client";

import { useDeferredValue, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchUsersSnapshot,
  type UserSnapshotRow,
  type UsersSnapshot
} from "@/lib/adminAnalyticsClient";

const BROADCAST_TITLE_PRESETS_KEY = "broadcast_title_presets";

const parseBroadcastTitlePresets = (rawValue: string | null | undefined) => {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    ).slice(0, 20);
  } catch {
    return [];
  }
};

export default function UsersPage() {
  const PAGE_SIZE = 50;
  const [users, setUsers] = useState<UserSnapshotRow[]>([]);
  const [search, setSearch] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastTitlePresets, setBroadcastTitlePresets] = useState<string[]>([]);
  const [selectedBroadcastTitleIndex, setSelectedBroadcastTitleIndex] = useState(-1);
  const [broadcastTitleDraft, setBroadcastTitleDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [presetStatus, setPresetStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const load = async (pageIndex: number, keyword: string) => {
    const snapshot: UsersSnapshot = await fetchUsersSnapshot({
      page: pageIndex,
      pageSize: PAGE_SIZE,
      search: keyword
    });
    setUsers(snapshot.users);
    setTotalCount(snapshot.totalCount);
    setTotalPages(snapshot.totalPages);
  };

  const loadBroadcastTitlePresets = async () => {
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", BROADCAST_TITLE_PRESETS_KEY)
      .maybeSingle();

    if (error) {
      throw error;
    }

    setBroadcastTitlePresets(parseBroadcastTitlePresets(data?.value));
  };

  const saveBroadcastTitlePresets = async (nextPresets: string[]) => {
    const sanitized = Array.from(
      new Set(
        nextPresets.map((value) => String(value || "").trim()).filter(Boolean)
      )
    ).slice(0, 20);

    const { error } = await supabase
      .from("settings")
      .upsert(
        [{ key: BROADCAST_TITLE_PRESETS_KEY, value: JSON.stringify(sanitized) }],
        { onConflict: "key" }
      );

    if (error) {
      throw error;
    }

    setBroadcastTitlePresets(sanitized);
    return sanitized;
  };

  useEffect(() => {
    load(page, deferredSearch).catch(() => {
      setUsers([]);
      setTotalCount(0);
      setTotalPages(1);
    });
  }, [page, deferredSearch]);

  useEffect(() => {
    loadBroadcastTitlePresets().catch(() => {
      setBroadcastTitlePresets([]);
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (selectedBroadcastTitleIndex < 0 || selectedBroadcastTitleIndex >= broadcastTitlePresets.length) {
      if (selectedBroadcastTitleIndex !== -1) {
        setSelectedBroadcastTitleIndex(-1);
      }
      setBroadcastTitleDraft("");
      return;
    }
    setBroadcastTitleDraft(broadcastTitlePresets[selectedBroadcastTitleIndex] || "");
  }, [selectedBroadcastTitleIndex, broadcastTitlePresets]);

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

  const sendMessageRequest = async (payload: { message: string; userId?: number; broadcast?: boolean }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setStatus("Chưa đăng nhập.");
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/telegram/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) {
        setStatus(result.error || "Gửi thất bại.");
        return;
      }
      if (payload.broadcast) {
        setStatus(
          `✅ Đã gửi ${result.success}/${result.total}.${result.failed ? ` Lỗi: ${result.failed}.` : ""}`
        );
      } else {
        setStatus(`✅ Đã gửi cho user ${payload.userId}.`);
      }
    } catch (error) {
      setStatus("Gửi thất bại.");
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async () => {
    const message = broadcastMessage.trim();
    const selectedTitle =
      selectedBroadcastTitleIndex >= 0 ? broadcastTitlePresets[selectedBroadcastTitleIndex]?.trim() || "" : "";
    const finalMessage = selectedTitle ? `${selectedTitle}\n${message}`.trim() : message;
    if (!finalMessage) return;
    if (!confirm("Gửi tin nhắn cho TẤT CẢ user đã nhắn bot?")) return;
    await sendMessageRequest({ message: finalMessage, broadcast: true });
    setBroadcastMessage("");
  };

  const handleAddBroadcastTitle = async () => {
    const normalized = broadcastTitleDraft.trim();
    if (!normalized) {
      setPresetStatus("Nhập title trước khi lưu.");
      return;
    }

    try {
      const nextPresets = await saveBroadcastTitlePresets([...broadcastTitlePresets, normalized]);
      const nextIndex = nextPresets.findIndex((value) => value === normalized);
      setSelectedBroadcastTitleIndex(nextIndex);
      setPresetStatus("✅ Đã lưu title broadcast.");
    } catch {
      setPresetStatus("Không thể lưu title broadcast.");
    }
  };

  const handleUpdateBroadcastTitle = async () => {
    const normalized = broadcastTitleDraft.trim();
    if (selectedBroadcastTitleIndex < 0) {
      setPresetStatus("Chọn title cần cập nhật.");
      return;
    }
    if (!normalized) {
      setPresetStatus("Title không được để trống.");
      return;
    }

    try {
      const nextPresets = [...broadcastTitlePresets];
      nextPresets[selectedBroadcastTitleIndex] = normalized;
      const savedPresets = await saveBroadcastTitlePresets(nextPresets);
      const nextIndex = savedPresets.findIndex((value) => value === normalized);
      setSelectedBroadcastTitleIndex(nextIndex);
      setPresetStatus("✅ Đã cập nhật title broadcast.");
    } catch {
      setPresetStatus("Không thể cập nhật title broadcast.");
    }
  };

  const handleDeleteBroadcastTitle = async () => {
    if (selectedBroadcastTitleIndex < 0) {
      setPresetStatus("Chọn title cần xóa.");
      return;
    }

    try {
      const nextPresets = broadcastTitlePresets.filter((_, index) => index !== selectedBroadcastTitleIndex);
      await saveBroadcastTitlePresets(nextPresets);
      setSelectedBroadcastTitleIndex(-1);
      setBroadcastTitleDraft("");
      setPresetStatus("✅ Đã xóa title broadcast.");
    } catch {
      setPresetStatus("Không thể xóa title broadcast.");
    }
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="muted">Quản lý người dùng và số dư.</p>
        </div>
      </div>

      <div className="card">
        <div className="form-grid">
          <input
            className="input"
            placeholder="Tìm theo user_id hoặc username"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Gửi tin nhắn cho tất cả user</h3>
        <div className="form-grid">
          <div className="form-section">
            <div className="section-title">Title broadcast</div>
            <p className="muted" style={{ marginBottom: 10 }}>
              Chọn title đã lưu để hệ thống tự ghép vào đầu nội dung khi broadcast.
            </p>
            <select
              className="select"
              value={selectedBroadcastTitleIndex >= 0 ? String(selectedBroadcastTitleIndex) : ""}
              onChange={(event) => {
                const nextValue = event.target.value;
                setSelectedBroadcastTitleIndex(nextValue === "" ? -1 : Number(nextValue));
                setPresetStatus(null);
              }}
            >
              <option value="">Không dùng title</option>
              {broadcastTitlePresets.map((title, index) => (
                <option key={`${index}-${title}`} value={index}>
                  {`Option ${index + 1}: ${title}`}
                </option>
              ))}
            </select>
            <textarea
              className="textarea"
              placeholder='Ví dụ: Thông báo !!!'
              value={broadcastTitleDraft}
              onChange={(event) => setBroadcastTitleDraft(event.target.value)}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="button secondary" type="button" onClick={handleAddBroadcastTitle}>
                Lưu title mới
              </button>
              <button className="button secondary" type="button" onClick={handleUpdateBroadcastTitle}>
                Cập nhật title
              </button>
              <button className="button secondary" type="button" onClick={handleDeleteBroadcastTitle}>
                Xóa title
              </button>
            </div>
            {presetStatus && <p className="muted" style={{ marginTop: 8 }}>{presetStatus}</p>}
          </div>
          <textarea
            className="textarea"
            placeholder="Nhập nội dung gửi cho tất cả user đã nhắn bot"
            value={broadcastMessage}
            onChange={(event) => setBroadcastMessage(event.target.value)}
          />
          {selectedBroadcastTitleIndex >= 0 && broadcastTitlePresets[selectedBroadcastTitleIndex] && (
            <p className="muted" style={{ marginTop: -4, whiteSpace: "pre-line" }}>
              Xem trước: {broadcastTitlePresets[selectedBroadcastTitleIndex]}
              {broadcastMessage.trim() ? `\n${broadcastMessage.trim()}` : ""}
            </p>
          )}
          <button className="button" type="button" disabled={sending} onClick={handleBroadcast}>
            {sending ? "Đang gửi..." : "Gửi tất cả"}
          </button>
        </div>
        {status && <p className="muted" style={{ marginTop: 8 }}>{status}</p>}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Username</th>
              <th>Tên người dùng</th>
              <th>Đơn đã mua</th>
              <th>Tổng đã mua (VND)</th>
              <th>Balance (VND)</th>
              <th>Balance (USDT)</th>
              <th>Lang</th>
              <th>Created</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.user_id}>
                <td>{user.user_id}</td>
                <td>{user.username ?? "-"}</td>
                <td>{user.display_name ?? "-"}</td>
                <td>{user.order_count.toLocaleString("vi-VN")}</td>
                <td>{user.total_paid.toLocaleString("vi-VN")}</td>
                <td>{(user.balance || 0).toLocaleString()}</td>
                <td>{user.balance_usdt?.toString() ?? "0"}</td>
                <td>{user.language ?? "vi"}</td>
                <td>{formatDateTime(user.created_at)}</td>
                <td>
                  <Link className="button secondary" href={`/users/${user.user_id}`}>
                    Nhắn tin
                  </Link>
                </td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td colSpan={10} className="muted">Chưa có dữ liệu.</td>
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
