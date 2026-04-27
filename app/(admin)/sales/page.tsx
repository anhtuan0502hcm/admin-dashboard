"use client";

import { useEffect, useMemo, useState } from "react";
import { adminApiRequest } from "@/lib/adminOpsClient";

const DEFAULT_SALE_CUSTOM_EMOJI_ID = "6055192572056309981";

type ProductRow = {
  id: number;
  name: string;
  price: number;
  price_usdt?: number | null;
  stock?: number;
};

type SaleCampaign = {
  id: number;
  name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  total_quantity_limit: number | null;
  per_user_limit: number | null;
  notify_on_start: boolean;
  notify_ending_soon: boolean;
  notes: string | null;
};

type SaleItem = {
  id: number;
  campaign_id: number;
  product_id: number;
  sale_name: string | null;
  sale_price_vnd: number;
  sale_price_usdt: number | null;
  original_price_vnd: number | null;
  discount_percent: number | null;
  promo_buy_quantity: number;
  promo_bonus_quantity: number;
  stock_mode: string;
  quantity_limit: number | null;
  per_user_limit: number | null;
  telegram_icon_custom_emoji_id: string | null;
  is_enabled: boolean;
  products?: { id: number; name: string; price: number; price_usdt?: number | null } | null;
  reservation_stats: { available: number; held: number; sold: number; released: number };
};

type SalesPayload = {
  campaigns: SaleCampaign[];
  items: SaleItem[];
  products: ProductRow[];
};

const formatMoney = (value: number | null | undefined) =>
  `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const toDateTimeLocal = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const defaultStartsAt = () => toDateTimeLocal(new Date());
const defaultEndsAt = () => toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));

export default function SalesPage() {
  const [data, setData] = useState<SalesPayload>({ campaigns: [], items: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [campaignPanelOpen, setCampaignPanelOpen] = useState(false);
  const [itemPanelOpen, setItemPanelOpen] = useState(false);
  const [stockMode, setStockMode] = useState<"existing" | "new">("existing");

  const [campaignForm, setCampaignForm] = useState({
    name: "",
    status: "scheduled",
    startsAt: defaultStartsAt(),
    endsAt: defaultEndsAt(),
    totalQuantityLimit: "",
    perUserLimit: "",
    notifyOnStart: false,
    notifyEndingSoon: true,
    notes: ""
  });

  const [itemForm, setItemForm] = useState({
    campaignId: "",
    productId: "",
    saleName: "",
    saleDescription: "",
    salePriceVnd: "",
    salePriceUsdt: "",
    stockQuantity: "10",
    newStockText: "",
    quantityLimit: "",
    perUserLimit: "",
    promoBuyQuantity: "0",
    promoBonusQuantity: "0",
    telegramIconCustomEmojiId: DEFAULT_SALE_CUSTOM_EMOJI_ID,
    sortPosition: ""
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await adminApiRequest<SalesPayload>("/api/admin/sales");
      setData(next);
      setItemForm((prev) => ({
        ...prev,
        campaignId: prev.campaignId || String(next.campaigns[0]?.id ?? ""),
        productId: prev.productId || String(next.products[0]?.id ?? "")
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải Sale.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const campaignById = useMemo(
    () => new Map(data.campaigns.map((campaign) => [campaign.id, campaign])),
    [data.campaigns]
  );

  const activeCampaigns = data.campaigns.filter((campaign) =>
    ["draft", "scheduled", "active", "paused"].includes(campaign.status)
  );

  const saleSummary = useMemo(() => {
    return data.items.reduce(
      (acc, item) => {
        acc.available += item.reservation_stats.available;
        acc.held += item.reservation_stats.held;
        acc.sold += item.reservation_stats.sold;
        return acc;
      },
      { available: 0, held: 0, sold: 0 }
    );
  }, [data.items]);

  const runAction = async (body: Record<string, unknown>, successMessage: string) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await adminApiRequest("/api/admin/sales", {
        method: "POST",
        body: JSON.stringify(body)
      });
      setNotice(successMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật Sale.");
    } finally {
      setSaving(false);
    }
  };

  const createCampaign = async () => {
    await runAction(
      {
        action: "create_campaign",
        ...campaignForm
      },
      "Đã tạo campaign Sale."
    );
    setCampaignForm((prev) => ({ ...prev, name: "", notes: "" }));
  };

  const addSaleItem = async () => {
    await runAction(
      {
        action: stockMode === "new" ? "add_item_new_stock" : "add_item_existing_stock",
        ...itemForm,
        telegramIconCustomEmojiId: itemForm.telegramIconCustomEmojiId || DEFAULT_SALE_CUSTOM_EMOJI_ID
      },
      "Đã thêm món Sale và reserve stock."
    );
    setItemForm((prev) => ({ ...prev, saleName: "", saleDescription: "", salePriceVnd: "", newStockText: "" }));
  };

  if (loading) {
    return <div className="card">Đang tải Sale...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Sales</h1>
          <p className="muted">Campaign Sale có thời hạn, stock reserve riêng và emoji custom mặc định cho Telegram Bot.</p>
        </div>
        <div className="page-actions">
          <button className="button secondary" onClick={load} disabled={saving}>Tải lại</button>
          <button className="button" onClick={() => setCampaignPanelOpen((value) => !value)}>Campaign</button>
          <button className="button" onClick={() => setItemPanelOpen((value) => !value)}>Thêm món Sale</button>
        </div>
      </div>

      {error && <div className="alert danger">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <span>Campaign</span>
          <strong>{data.campaigns.length}</strong>
        </div>
        <div className="stat-card">
          <span>Món Sale</span>
          <strong>{data.items.length}</strong>
        </div>
        <div className="stat-card">
          <span>Stock trống</span>
          <strong>{saleSummary.available}</strong>
        </div>
        <div className="stat-card">
          <span>Đã bán</span>
          <strong>{saleSummary.sold}</strong>
        </div>
      </div>

      {campaignPanelOpen && (
        <section className="action-panel">
          <div className="section-header">
            <div>
              <h2>Tạo Campaign</h2>
              <p className="muted">Dùng `scheduled` cho Sale tương lai hoặc `active` nếu bắt đầu ngay.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Tên campaign
              <input value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} />
            </label>
            <label>
              Trạng thái
              <select value={campaignForm.status} onChange={(e) => setCampaignForm({ ...campaignForm, status: e.target.value })}>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </label>
            <label>
              Bắt đầu
              <input type="datetime-local" value={campaignForm.startsAt} onChange={(e) => setCampaignForm({ ...campaignForm, startsAt: e.target.value })} />
            </label>
            <label>
              Kết thúc
              <input type="datetime-local" value={campaignForm.endsAt} onChange={(e) => setCampaignForm({ ...campaignForm, endsAt: e.target.value })} />
            </label>
            <label>
              Giới hạn tổng
              <input value={campaignForm.totalQuantityLimit} onChange={(e) => setCampaignForm({ ...campaignForm, totalQuantityLimit: e.target.value })} placeholder="Tuỳ chọn" />
            </label>
            <label>
              Giới hạn mỗi user
              <input value={campaignForm.perUserLimit} onChange={(e) => setCampaignForm({ ...campaignForm, perUserLimit: e.target.value })} placeholder="Tuỳ chọn" />
            </label>
          </div>
          <label className="full-width-field">
            Ghi chú nội bộ
            <textarea rows={3} value={campaignForm.notes} onChange={(e) => setCampaignForm({ ...campaignForm, notes: e.target.value })} />
          </label>
          <div className="toggle-row">
            <label><input type="checkbox" checked={campaignForm.notifyOnStart} onChange={(e) => setCampaignForm({ ...campaignForm, notifyOnStart: e.target.checked })} /> Notify khi bắt đầu</label>
            <label><input type="checkbox" checked={campaignForm.notifyEndingSoon} onChange={(e) => setCampaignForm({ ...campaignForm, notifyEndingSoon: e.target.checked })} /> Notify sắp kết thúc</label>
          </div>
          <button className="button" disabled={saving} onClick={createCampaign}>Tạo campaign</button>
        </section>
      )}

      {itemPanelOpen && (
        <section className="action-panel">
          <div className="section-header">
            <div>
              <h2>Thêm Món Sale</h2>
              <p className="muted">Chọn stock có sẵn để reserve hoặc thêm stock mới rồi đưa vào Sale ngay.</p>
            </div>
            <div className="segmented">
              <button className={stockMode === "existing" ? "active" : ""} onClick={() => setStockMode("existing")}>Stock có sẵn</button>
              <button className={stockMode === "new" ? "active" : ""} onClick={() => setStockMode("new")}>Stock mới</button>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Campaign
              <select value={itemForm.campaignId} onChange={(e) => setItemForm({ ...itemForm, campaignId: e.target.value })}>
                {activeCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
              </select>
            </label>
            <label>
              Sản phẩm gốc
              <select value={itemForm.productId} onChange={(e) => setItemForm({ ...itemForm, productId: e.target.value })}>
                {data.products.map((product) => <option key={product.id} value={product.id}>{product.name} - {formatMoney(product.price)}</option>)}
              </select>
            </label>
            <label>
              Tên Sale
              <input value={itemForm.saleName} onChange={(e) => setItemForm({ ...itemForm, saleName: e.target.value })} placeholder="Trống = dùng tên gốc" />
            </label>
            <label>
              Giá Sale VNĐ
              <input value={itemForm.salePriceVnd} onChange={(e) => setItemForm({ ...itemForm, salePriceVnd: e.target.value })} />
            </label>
            <label>
              Giá Sale USDT
              <input value={itemForm.salePriceUsdt} onChange={(e) => setItemForm({ ...itemForm, salePriceUsdt: e.target.value })} placeholder="Tuỳ chọn" />
            </label>
            <label>
              Stock Sale
              <input value={itemForm.stockQuantity} onChange={(e) => setItemForm({ ...itemForm, stockQuantity: e.target.value })} disabled={stockMode === "new"} />
            </label>
            <label>
              Giới hạn item
              <input value={itemForm.quantityLimit} onChange={(e) => setItemForm({ ...itemForm, quantityLimit: e.target.value })} placeholder="Mặc định = stock Sale" />
            </label>
            <label>
              Giới hạn mỗi user
              <input value={itemForm.perUserLimit} onChange={(e) => setItemForm({ ...itemForm, perUserLimit: e.target.value })} placeholder="Tuỳ chọn" />
            </label>
            <label>
              Mua X
              <input value={itemForm.promoBuyQuantity} onChange={(e) => setItemForm({ ...itemForm, promoBuyQuantity: e.target.value })} />
            </label>
            <label>
              Tặng Y
              <input value={itemForm.promoBonusQuantity} onChange={(e) => setItemForm({ ...itemForm, promoBonusQuantity: e.target.value })} />
            </label>
            <label>
              Custom emoji ID
              <input value={itemForm.telegramIconCustomEmojiId} onChange={(e) => setItemForm({ ...itemForm, telegramIconCustomEmojiId: e.target.value })} />
            </label>
            <label>
              Vị trí
              <input value={itemForm.sortPosition} onChange={(e) => setItemForm({ ...itemForm, sortPosition: e.target.value })} placeholder="Tuỳ chọn" />
            </label>
          </div>
          <label className="full-width-field">
            Mô tả Sale
            <textarea rows={3} value={itemForm.saleDescription} onChange={(e) => setItemForm({ ...itemForm, saleDescription: e.target.value })} />
          </label>
          {stockMode === "new" && (
            <label className="full-width-field">
              Stock mới, mỗi dòng một item
              <textarea rows={8} value={itemForm.newStockText} onChange={(e) => setItemForm({ ...itemForm, newStockText: e.target.value, stockQuantity: String(e.target.value.split(/\r?\n/).filter((line) => line.trim()).length) })} />
            </label>
          )}
          <button className="button" disabled={saving || !activeCampaigns.length} onClick={addSaleItem}>Thêm món Sale</button>
        </section>
      )}

      <section className="table-card">
        <div className="section-header">
          <h2>Campaign</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th>Limit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>{campaign.name}</td>
                  <td><span className={`status-pill ${campaign.status}`}>{campaign.status}</span></td>
                  <td>{new Date(campaign.starts_at).toLocaleString("vi-VN")} - {new Date(campaign.ends_at).toLocaleString("vi-VN")}</td>
                  <td>Tổng {campaign.total_quantity_limit ?? "-"} / User {campaign.per_user_limit ?? "-"}</td>
                  <td className="table-actions">
                    <button className="button secondary" disabled={saving} onClick={() => runAction({ action: "set_campaign_status", campaignId: campaign.id, status: "active" }, "Đã active campaign.")}>Active</button>
                    <button className="button secondary" disabled={saving} onClick={() => runAction({ action: "set_campaign_status", campaignId: campaign.id, status: "paused" }, "Đã pause campaign.")}>Pause</button>
                    <button className="button danger" disabled={saving} onClick={() => runAction({ action: "set_campaign_status", campaignId: campaign.id, status: "ended" }, "Đã kết thúc campaign.")}>End</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="table-card">
        <div className="section-header">
          <h2>Món Sale</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Món</th>
                <th>Campaign</th>
                <th>Giá</th>
                <th>Stock Sale</th>
                <th>Limit</th>
                <th>Mode</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>{item.sale_name || item.products?.name || `#${item.product_id}`}</div>
                    <div className="muted">Emoji ID: {item.telegram_icon_custom_emoji_id || DEFAULT_SALE_CUSTOM_EMOJI_ID}</div>
                  </td>
                  <td>{campaignById.get(item.campaign_id)?.name || `#${item.campaign_id}`}</td>
                  <td>
                    <div>{formatMoney(item.sale_price_vnd)}</div>
                    <div className="muted">Gốc {formatMoney(item.original_price_vnd)}</div>
                  </td>
                  <td>
                    Trống {item.reservation_stats.available} / Giữ {item.reservation_stats.held} / Bán {item.reservation_stats.sold}
                  </td>
                  <td>Item {item.quantity_limit ?? "-"} / User {item.per_user_limit ?? "-"}</td>
                  <td>{item.stock_mode}</td>
                  <td className="table-actions">
                    <button
                      className="button secondary"
                      disabled={saving}
                      onClick={() => runAction({ action: "set_item_enabled", saleItemId: item.id, enabled: !item.is_enabled }, item.is_enabled ? "Đã tắt món Sale." : "Đã bật món Sale.")}
                    >
                      {item.is_enabled ? "Tắt" : "Bật"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
