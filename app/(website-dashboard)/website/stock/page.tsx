"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Product {
  id: number;
  name: string;
  website_name: string | null;
}

interface StockItem {
  id: number;
  product_id: number;
  content: string;
  sold: boolean;
}

interface StockSummary {
  total: number;
  sold: number;
  remaining: number;
}

export default function StockPage() {
  const PAGE_SIZE = 100;
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockSummary, setStockSummary] = useState<StockSummary>({ total: 0, sold: 0, remaining: 0 });
  const [content, setContent] = useState("");
  const [stockFormTab, setStockFormTab] = useState<"add" | "delete">("add");
  const [deleteContent, setDeleteContent] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const [selectedStockIds, setSelectedStockIds] = useState<Set<number>>(new Set());
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSold, setEditSold] = useState(false);
  const [deleteStock, setDeleteStock] = useState<StockItem | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkSoldAction, setBulkSoldAction] = useState<"keep" | "available" | "sold">("keep");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteByTextPlan, setDeleteByTextPlan] = useState<{ ids: number[]; queries: string[] } | null>(
    null
  );
  const [deleteByTextOpen, setDeleteByTextOpen] = useState(false);
  const [deleteByTextBusy, setDeleteByTextBusy] = useState(false);
  const [deleteByTextError, setDeleteByTextError] = useState<string | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, website_name")
      .eq("website_deleted", false)
      .order("website_sort_position", { ascending: true, nullsFirst: false })
      .order("id");
    if (error) {
      const { data: fallbackData } = await supabase.from("products").select("id, name").order("id");
      setProducts(((fallbackData as Product[]) || []).map((row) => ({ ...row, website_name: null })));
      return;
    }
    setProducts(
      ((data as Product[]) || []).map((row) => ({
        ...row,
        name: row.website_name?.trim() || row.name
      }))
    );
  };

  const loadStock = async (productId: string, pageIndex = page) => {
    if (!productId) return;
    const from = (pageIndex - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from("stock")
      .select("id, product_id, content, sold", { count: "exact" })
      .eq("product_id", Number(productId))
      .order("sold", { ascending: true })
      .order("id", { ascending: false })
      .range(from, to);
    setStockItems((data as StockItem[]) || []);
    setTotalCount(count ?? 0);
  };

  const loadStockSummary = async (productId: string) => {
    if (!productId) {
      setStockSummary({ total: 0, sold: 0, remaining: 0 });
      return;
    }

    const numericProductId = Number(productId);
    const [totalRes, soldRes] = await Promise.all([
      supabase
        .from("stock")
        .select("id", { count: "exact", head: true })
        .eq("product_id", numericProductId),
      supabase
        .from("stock")
        .select("id", { count: "exact", head: true })
        .eq("product_id", numericProductId)
        .eq("sold", true)
    ]);

    const total = totalRes.count ?? 0;
    const sold = soldRes.count ?? 0;
    setStockSummary({
      total,
      sold,
      remaining: Math.max(total - sold, 0)
    });
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!selectedProductId) {
      setStockItems([]);
      setTotalCount(0);
      setStockSummary({ total: 0, sold: 0, remaining: 0 });
      setSelectedStockIds(new Set());
      return;
    }
    setPage(1);
    setSelectedStockIds(new Set());
  }, [selectedProductId]);

  useEffect(() => {
    if (selectedProductId) {
      loadStock(selectedProductId, page);
    }
  }, [selectedProductId, page]);

  useEffect(() => {
    if (!selectedProductId) return;
    loadStockSummary(selectedProductId);
  }, [selectedProductId]);

  useEffect(() => {
    // Selection is scoped to the current page and product filter for predictable bulk actions.
    setSelectedStockIds(new Set());
  }, [page]);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    if (!stockItems.length) {
      el.indeterminate = false;
      return;
    }
    const selectedOnPage = stockItems.reduce(
      (acc, item) => acc + (selectedStockIds.has(item.id) ? 1 : 0),
      0
    );
    el.indeterminate = selectedOnPage > 0 && selectedOnPage < stockItems.length;
  }, [stockItems, selectedStockIds]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const parseMultiline = (text: string) =>
    Array.from(
      new Set(
        text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      )
    );

  const handleAddStock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProductId) return;
    const lines = parseMultiline(content);
    if (!lines.length) return;

    const payload = lines.map((line) => ({
      product_id: Number(selectedProductId),
      content: line
    }));

    await supabase.from("stock").insert(payload);
    setContent("");
    await loadStockSummary(selectedProductId);
    if (page === 1) {
      await loadStock(selectedProductId, 1);
    } else {
      setPage(1);
    }
  };

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedStockIds((prev) => {
      const next = new Set(prev);
      for (const item of stockItems) {
        if (checked) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
  };

  const toggleSelectOne = (id: number, checked: boolean) => {
    setSelectedStockIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkEditSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (bulkBusy) return;
    const ids = Array.from(selectedStockIds);
    if (!ids.length) return;
    if (bulkSoldAction === "keep") {
      setBulkEditOpen(false);
      return;
    }
    setBulkBusy(true);
    const soldValue = bulkSoldAction === "sold";
    await supabase.from("stock").update({ sold: soldValue }).in("id", ids);
    setBulkBusy(false);
    setBulkEditOpen(false);
    setBulkSoldAction("keep");
    setSelectedStockIds(new Set());
    await loadStockSummary(selectedProductId);
    await loadStock(selectedProductId, page);
  };

  const handleBulkDeleteConfirm = async () => {
    if (bulkBusy) return;
    const ids = Array.from(selectedStockIds);
    if (!ids.length) return;
    setBulkBusy(true);
    await supabase.from("stock").delete().in("id", ids);
    setBulkBusy(false);
    setBulkDeleteOpen(false);
    setSelectedStockIds(new Set());
    await loadStockSummary(selectedProductId);
    const removedOnPage = stockItems.filter((item) => ids.includes(item.id)).length;
    const shouldGoPrev = removedOnPage === stockItems.length && page > 1;
    if (shouldGoPrev) setPage(page - 1);
    else await loadStock(selectedProductId, page);
  };

  const prepareDeleteByText = async (event: React.FormEvent) => {
    event.preventDefault();
    if (deleteByTextBusy) return;
    if (!selectedProductId) return;
    const queries = parseMultiline(deleteContent);
    if (!queries.length) return;

    setDeleteByTextBusy(true);
    setDeleteByTextError(null);
    try {
      const matchedIds = new Set<number>();
      for (const query of queries) {
        const { data, error } = await supabase
          .from("stock")
          .select("id")
          .eq("product_id", Number(selectedProductId))
          .ilike("content", `%${query}%`)
          .range(0, 9999);
        if (error) throw error;
        for (const row of (data as Array<{ id: number }>) ?? []) {
          matchedIds.add(row.id);
        }
      }
      const ids = Array.from(matchedIds);
      setDeleteByTextPlan({ ids, queries });
      setDeleteByTextOpen(true);
    } catch (err) {
      setDeleteByTextError(err instanceof Error ? err.message : "Không thể kiểm tra stock cần xóa.");
    } finally {
      setDeleteByTextBusy(false);
    }
  };

  const handleDeleteByTextConfirm = async () => {
    if (!deleteByTextPlan) return;
    if (deleteByTextBusy) return;

    setDeleteByTextBusy(true);
    try {
      if (deleteByTextPlan.ids.length) {
        await supabase.from("stock").delete().in("id", deleteByTextPlan.ids);
      }
      setDeleteByTextOpen(false);
      setDeleteByTextPlan(null);
      setDeleteContent("");
      setSelectedStockIds(new Set());
      await loadStockSummary(selectedProductId);
      if (page === 1) await loadStock(selectedProductId, 1);
      else setPage(1);
    } finally {
      setDeleteByTextBusy(false);
    }
  };

  const startEdit = (item: StockItem) => {
    setEditingStock(item);
    setEditContent(item.content);
    setEditSold(item.sold);
  };

  const cancelEdit = () => {
    setEditingStock(null);
    setEditContent("");
    setEditSold(false);
  };

  const handleEditSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingStock) return;
    const cleaned = editContent.trim();
    if (!cleaned) return;
    await supabase
      .from("stock")
      .update({ content: cleaned, sold: editSold })
      .eq("id", editingStock.id);
    cancelEdit();
    await loadStockSummary(selectedProductId);
    await loadStock(selectedProductId, page);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteStock) return;
    await supabase.from("stock").delete().eq("id", deleteStock.id);
    await loadStockSummary(selectedProductId);
    const shouldGoPrev = stockItems.length === 1 && page > 1;
    setDeleteStock(null);
    if (shouldGoPrev) {
      setPage(page - 1);
    } else {
      await loadStock(selectedProductId, page);
    }
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Website Stock</h1>
          <p className="muted">Tab Stock của Website Dashboard (logic giống Bot Dashboard).</p>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title">Chọn sản phẩm</h3>
        <div className="form-grid">
          <select
            className="select"
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
          >
            <option value="">-- Chọn sản phẩm --</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
        {selectedProductId && (
          <div className="grid stats" style={{ marginTop: 12 }}>
            <div className="card" style={{ boxShadow: "none", padding: 14 }}>
              <p className="muted">Tổng</p>
              <h2>{stockSummary.total.toLocaleString("vi-VN")}</h2>
            </div>
            <div className="card" style={{ boxShadow: "none", padding: 14 }}>
              <p className="muted">Đã bán</p>
              <h2>{stockSummary.sold.toLocaleString("vi-VN")}</h2>
            </div>
            <div className="card" style={{ boxShadow: "none", padding: 14 }}>
              <p className="muted">Còn lại</p>
              <h2>{stockSummary.remaining.toLocaleString("vi-VN")}</h2>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="section-title">Thêm stock mới</h3>
        <div className="segmented" role="tablist" aria-label="Stock form" style={{ marginBottom: 12 }}>
          <button
            type="button"
            role="tab"
            aria-selected={stockFormTab === "add"}
            className={`segmented-button ${stockFormTab === "add" ? "active" : ""}`}
            onClick={() => setStockFormTab("add")}
          >
            Thêm
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={stockFormTab === "delete"}
            className={`segmented-button danger ${stockFormTab === "delete" ? "active" : ""}`}
            onClick={() => setStockFormTab("delete")}
          >
            Xóa
          </button>
        </div>

        {stockFormTab === "add" && (
          <form onSubmit={handleAddStock} className="form-split">
            <textarea
              className="textarea"
              placeholder="Mỗi dòng là 1 stock"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <button className="button" type="submit" disabled={!selectedProductId}>
              Thêm stock
            </button>
          </form>
        )}

        {stockFormTab === "delete" && (
          <form onSubmit={prepareDeleteByText} className="form-split">
            <textarea
              className="textarea"
              placeholder="Mỗi dòng là 1 nội dung cần xóa (email / text / full content)"
              value={deleteContent}
              onChange={(event) => setDeleteContent(event.target.value)}
            />
            <button
              className="button danger"
              type="submit"
              disabled={!selectedProductId || deleteByTextBusy}
            >
              {deleteByTextBusy ? "Đang kiểm tra..." : "Xóa"}
            </button>
            {deleteByTextError && (
              <p className="muted" style={{ gridColumn: "1 / -1", color: "var(--danger)" }}>
                {deleteByTextError}
              </p>
            )}
            {!selectedProductId && (
              <p className="muted" style={{ gridColumn: "1 / -1" }}>
                Vui lòng chọn sản phẩm trước khi xóa.
              </p>
            )}
          </form>
        )}
      </div>

      <div className="card">
        <h3 className="section-title">Danh sách stock</h3>
        <div className="table-actions" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <div className="muted">Đã chọn: {selectedStockIds.size}</div>
          <div className="table-actions">
            <button
              type="button"
              className="button secondary"
              disabled={!selectedStockIds.size}
              onClick={() => {
                setBulkSoldAction("keep");
                setBulkEditOpen(true);
              }}
            >
              Chỉnh sửa đã chọn
            </button>
            <button
              type="button"
              className="button danger"
              disabled={!selectedStockIds.size}
              onClick={() => setBulkDeleteOpen(true)}
            >
              Xóa đã chọn
            </button>
          </div>
        </div>
        <table className="table fixed">
          <colgroup>
            <col style={{ width: 44 }} />
            <col style={{ width: 80 }} />
            <col />
            <col style={{ width: 110 }} />
            <col style={{ width: 220 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="checkbox-cell">
                <input
                  type="checkbox"
                  className="checkbox"
                  ref={selectAllRef}
                  aria-label="Chọn tất cả stock trong trang"
                  checked={
                    stockItems.length > 0 && stockItems.every((item) => selectedStockIds.has(item.id))
                  }
                  onChange={(event) => toggleSelectAllOnPage(event.target.checked)}
                />
              </th>
              <th>ID</th>
              <th>Nội dung</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {stockItems.map((item) => (
              <tr key={item.id}>
                <td className="checkbox-cell">
                  <input
                    type="checkbox"
                    className="checkbox"
                    aria-label={`Chọn stock #${item.id}`}
                    checked={selectedStockIds.has(item.id)}
                    onChange={(event) => toggleSelectOne(item.id, event.target.checked)}
                  />
                </td>
                <td>#{item.id}</td>
                <td>
                  <div className="cell-truncate" title={item.content}>
                    {item.content}
                  </div>
                </td>
                <td>{item.sold ? "Đã bán" : "Còn"}</td>
                <td>
                  <div className="table-actions">
                    <button type="button" className="button secondary" onClick={() => startEdit(item)}>
                      Chỉnh sửa
                    </button>
                    <button type="button" className="button danger" onClick={() => setDeleteStock(item)}>
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!stockItems.length && (
              <tr>
                <td colSpan={5} className="muted">Chưa có stock.</td>
              </tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
            <button className="button secondary" disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))}>
              Trang trước
            </button>
            <span className="muted">Trang {page}/{totalPages} · Tổng {totalCount}</span>
            <button className="button secondary" disabled={page === totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))}>
              Trang sau
            </button>
          </div>
        )}
      </div>

      {editingStock && (
        <div className="modal-backdrop" onClick={cancelEdit}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="section-title">Chỉnh sửa stock #{editingStock.id}</h3>
            <form className="form-grid" onSubmit={handleEditSave}>
              <textarea
                className="textarea form-section"
                placeholder="Nội dung stock"
                value={editContent}
                onChange={(event) => setEditContent(event.target.value)}
              />
              <div className="toggle">
                <input
                  type="checkbox"
                  checked={editSold}
                  onChange={(event) => setEditSold(event.target.checked)}
                />
                Đã bán
              </div>
              <div className="modal-actions">
                <button className="button" type="submit">Lưu</button>
                <button className="button secondary" type="button" onClick={cancelEdit}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteStock && (
        <div className="modal-backdrop" onClick={() => setDeleteStock(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="section-title">Xóa stock #{deleteStock.id}</h3>
            <p className="muted" style={{ marginTop: 8 }}>
              Bạn có chắc muốn xóa stock này?
            </p>
            <div className="modal-actions">
              <button className="button danger" type="button" onClick={handleDeleteConfirm}>Xóa</button>
              <button className="button secondary" type="button" onClick={() => setDeleteStock(null)}>Hủy</button>
            </div>
          </div>
        </div>
      )}

      {bulkEditOpen && (
        <div className="modal-backdrop" onClick={() => setBulkEditOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="section-title">Chỉnh sửa {selectedStockIds.size} stock</h3>
            <form className="form-grid" onSubmit={handleBulkEditSave}>
              <select
                className="select form-section"
                value={bulkSoldAction}
                onChange={(event) =>
                  setBulkSoldAction(event.target.value as "keep" | "available" | "sold")
                }
              >
                <option value="keep">Giữ nguyên trạng thái</option>
                <option value="available">Đánh dấu còn</option>
                <option value="sold">Đánh dấu đã bán</option>
              </select>
              <div className="modal-actions">
                <button className="button" type="submit" disabled={bulkBusy}>
                  {bulkBusy ? "Đang lưu..." : "Lưu"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setBulkEditOpen(false)}
                  disabled={bulkBusy}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bulkDeleteOpen && (
        <div className="modal-backdrop" onClick={() => setBulkDeleteOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="section-title">Xóa {selectedStockIds.size} stock</h3>
            <p className="muted" style={{ marginTop: 8 }}>
              Bạn có chắc muốn xóa {selectedStockIds.size} stock đã chọn?
            </p>
            <div className="modal-actions">
              <button
                className="button danger"
                type="button"
                onClick={handleBulkDeleteConfirm}
                disabled={bulkBusy}
              >
                {bulkBusy ? "Đang xóa..." : "Xóa"}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                disabled={bulkBusy}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteByTextOpen && deleteByTextPlan && (
        <div className="modal-backdrop" onClick={() => setDeleteByTextOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3 className="section-title">Xác nhận xóa stock</h3>
            <p className="muted" style={{ marginTop: 8 }}>
              Tìm thấy {deleteByTextPlan.ids.length} stock khớp với {deleteByTextPlan.queries.length} dòng nhập vào.
              Bạn có chắc muốn xóa?
            </p>
            <div className="modal-actions">
              <button
                className="button danger"
                type="button"
                onClick={handleDeleteByTextConfirm}
                disabled={deleteByTextBusy || deleteByTextPlan.ids.length === 0}
              >
                {deleteByTextBusy ? "Đang xóa..." : "Xóa"}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setDeleteByTextOpen(false)}
                disabled={deleteByTextBusy}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
