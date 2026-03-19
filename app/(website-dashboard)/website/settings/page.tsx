"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type AppBannerItem = {
  id: string;
  image_url: string;
  title: string;
  subtitle: string;
  link: string;
};

type MiddleBannerItem = {
  id: string;
  image_url: string;
  link: string;
};

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  enabled: boolean;
};

const DEFAULT_APP_BANNERS: Omit<AppBannerItem, "id">[] = [
  { image_url: "", title: "Microsoft Office", subtitle: "Bản quyền", link: "" },
  { image_url: "", title: "Khám phá thế giới AI", subtitle: "Siêu tối ưu", link: "" },
  { image_url: "", title: "Ứng dụng VPN", subtitle: "Tốc độ - bảo mật", link: "" },
  { image_url: "", title: "Steam Wallet", subtitle: "Siêu tiết kiệm", link: "" }
];

const WEBSITE_SETTINGS_KEYS = [
  "website_bank_name",
  "website_account_number",
  "website_account_name",
  "website_sepay_token",
  "website_binance_pay_id",
  "website_admin_contact",
  "website_support_contacts",
  "website_shop_page_size",
  "website_payment_mode",
  "website_show_app_banners",
  "website_show_stats_section",
  "website_show_stats_feedback",
  "website_show_stats_sold",
  "website_show_stats_customers",
  "website_faq_items",
  "website_banner_middle_url",
  "website_banner_middles",
  "website_banner_ads_left_url",
  "website_banner_ads_right_url",
  "website_banner_ads_left_link",
  "website_banner_ads_right_link",
  "website_banner_apps",
  "website_banner_app_1_url",
  "website_banner_app_2_url",
  "website_banner_app_3_url",
  "website_banner_app_4_url"
];

const makeBannerId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeBannerRow = (row: Partial<AppBannerItem>): AppBannerItem => ({
  id: row.id || makeBannerId(),
  image_url: String(row.image_url || ""),
  title: String(row.title || ""),
  subtitle: String(row.subtitle || ""),
  link: String(row.link || "")
});

const normalizeMiddleBannerRow = (row: Partial<MiddleBannerItem>): MiddleBannerItem => ({
  id: row.id || makeBannerId(),
  image_url: String(row.image_url || ""),
  link: String(row.link || "")
});

const parseBannerApps = (raw: string, valuesMap: Record<string, string>) => {
  const rawJson = String(raw || "").trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        const rows = parsed.map((row: any) => normalizeBannerRow(row));
        if (rows.length) return rows;
      }
    } catch {
      // ignore invalid saved JSON and fallback to old keys
    }
  }

  const legacy = [1, 2, 3, 4]
    .map((index) => valuesMap[`website_banner_app_${index}_url`] || "")
    .map((image, index) => normalizeBannerRow({ ...DEFAULT_APP_BANNERS[index], image_url: image }))
    .filter((row) => row.image_url || row.title || row.subtitle || row.link);

  if (legacy.length) return legacy;
  return DEFAULT_APP_BANNERS.map((row) => normalizeBannerRow(row));
};

const parseMiddleBanners = (raw: string, valuesMap: Record<string, string>) => {
  const rawJson = String(raw || "").trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        const rows = parsed
          .map((row: any) => normalizeMiddleBannerRow(row))
          .filter((row) => row.image_url || row.link);
        if (rows.length) return rows;
      }
    } catch {
      // fallback to legacy single field
    }
  }

  const legacy = String(valuesMap.website_banner_middle_url || "").trim();
  if (legacy) {
    return [normalizeMiddleBannerRow({ image_url: legacy, link: "" })];
  }
  return [];
};

const sanitizeAppBannersForSave = (rows: AppBannerItem[]) =>
  rows
    .map((row) => ({
      image_url: row.image_url.trim(),
      title: row.title.trim(),
      subtitle: row.subtitle.trim(),
      link: row.link.trim()
    }))
    .filter((row) => row.image_url || row.title || row.subtitle || row.link);

const sanitizeMiddleBannersForSave = (rows: MiddleBannerItem[]) =>
  rows
    .map((row) => ({
      image_url: row.image_url.trim(),
      link: row.link.trim()
    }))
    .filter((row) => row.image_url || row.link);

const parseFaqItems = (raw: string): FaqItem[] => {
  const rawJson = String(raw || "").trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) {
        return parsed
          .map((row: any) => ({
            id: makeBannerId(),
            question: String(row?.question || ""),
            answer: String(row?.answer || ""),
            enabled: row?.enabled !== false
          }))
          .filter((row) => row.question.trim() || row.answer.trim());
      }
    } catch {
      // ignore invalid JSON and fallback
    }
  }

  return [
    {
      id: makeBannerId(),
      question: "Shop này chạy theo logic nào?",
      answer: "Đồng bộ với Bot Telegram và Dashboard hiện tại: giá, tồn kho, direct order, SePay checker.",
      enabled: true
    },
    {
      id: makeBannerId(),
      question: "Có hỗ trợ sau thanh toán không?",
      answer: "Đơn confirmed được xử lý theo tồn kho. Bạn có thể tra mã thanh toán ở mục Status hoặc liên hệ hỗ trợ.",
      enabled: true
    }
  ];
};

const sanitizeFaqItemsForSave = (rows: FaqItem[]) =>
  rows
    .map((row) => ({
      question: row.question.trim(),
      answer: row.answer.trim(),
      enabled: row.enabled
    }))
    .filter((row) => row.question && row.answer);

export default function WebsiteSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [appBanners, setAppBanners] = useState<AppBannerItem[]>([]);
  const [middleBanners, setMiddleBanners] = useState<MiddleBannerItem[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", WEBSITE_SETTINGS_KEYS);

    if (error) {
      setMessage(`Lỗi tải Website settings: ${error.message}`);
      return;
    }

    const map: Record<string, string> = {};
    (data || []).forEach((row: any) => {
      map[row.key] = row.value || "";
    });
    setValues(map);
    setAppBanners(parseBannerApps(map.website_banner_apps || "", map));
    setMiddleBanners(parseMiddleBanners(map.website_banner_middles || "", map));
    setFaqItems(parseFaqItems(map.website_faq_items || ""));
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const updateAppBanner = (id: string, key: keyof Omit<AppBannerItem, "id">, value: string) => {
    setAppBanners((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addAppBanner = () => {
    setAppBanners((prev) => [...prev, normalizeBannerRow({})]);
  };

  const removeAppBanner = (id: string) => {
    setAppBanners((prev) => prev.filter((row) => row.id !== id));
  };

  const updateMiddleBanner = (id: string, key: keyof Omit<MiddleBannerItem, "id">, value: string) => {
    setMiddleBanners((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addMiddleBanner = () => {
    setMiddleBanners((prev) => [...prev, normalizeMiddleBannerRow({})]);
  };

  const removeMiddleBanner = (id: string) => {
    setMiddleBanners((prev) => prev.filter((row) => row.id !== id));
  };

  const updateFaqItem = (id: string, key: keyof Omit<FaqItem, "id">, value: string | boolean) => {
    setFaqItems((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const addFaqItem = () => {
    setFaqItems((prev) => [...prev, { id: makeBannerId(), question: "", answer: "", enabled: true }]);
  };

  const removeFaqItem = (id: string) => {
    setFaqItems((prev) => prev.filter((row) => row.id !== id));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const normalizedAppBanners = sanitizeAppBannersForSave(appBanners);
    const appBannerJson = JSON.stringify(normalizedAppBanners);
    const normalizedMiddleBanners = sanitizeMiddleBannersForSave(middleBanners);
    const middleBannerJson = JSON.stringify(normalizedMiddleBanners);
    const normalizedFaqItems = sanitizeFaqItemsForSave(faqItems);
    const faqItemsJson = JSON.stringify(normalizedFaqItems);

    const payload = WEBSITE_SETTINGS_KEYS.map((key) => {
      if (key === "website_shop_page_size") {
        const parsed = Number.parseInt(values[key] || "10", 10);
        const normalized = Number.isFinite(parsed) ? Math.min(50, Math.max(1, parsed)) : 10;
        return { key, value: String(normalized) };
      }

      if (key === "website_banner_apps") {
        return { key, value: appBannerJson };
      }

      if (key === "website_banner_middles") {
        return { key, value: middleBannerJson };
      }

      if (key === "website_faq_items") {
        return { key, value: faqItemsJson };
      }

      if (key === "website_banner_middle_url") {
        return { key, value: normalizedMiddleBanners[0]?.image_url || "" };
      }

      if (key.startsWith("website_banner_app_") && key.endsWith("_url")) {
        const index = Number.parseInt(key.replace("website_banner_app_", "").replace("_url", ""), 10) - 1;
        const fallback = normalizedAppBanners[index]?.image_url || "";
        return { key, value: fallback };
      }

      return { key, value: values[key] || "" };
    });

    const { error } = await supabase.from("settings").upsert(payload);
    if (error) {
      setMessage(`Lưu thất bại: ${error.message}`);
      return;
    }

    setMessage("Đã lưu Website settings.");
    await load();
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">Website Settings</h1>
          <p className="muted">Bộ settings riêng cho Website (không dùng chung với Bot Telegram).</p>
        </div>
      </div>

      <div className="card">
        <form className="form-grid" onSubmit={save}>
          <input
            className="input"
            placeholder="Website bank name"
            value={values.website_bank_name || ""}
            onChange={(e) => updateField("website_bank_name", e.target.value)}
          />
          <input
            className="input"
            placeholder="Website account number"
            value={values.website_account_number || ""}
            onChange={(e) => updateField("website_account_number", e.target.value)}
          />
          <input
            className="input"
            placeholder="Website account name"
            value={values.website_account_name || ""}
            onChange={(e) => updateField("website_account_name", e.target.value)}
          />
          <input
            className="input"
            placeholder="Website SePay token"
            value={values.website_sepay_token || ""}
            onChange={(e) => updateField("website_sepay_token", e.target.value)}
          />
          <input
            className="input"
            placeholder="Website Binance Pay ID"
            value={values.website_binance_pay_id || ""}
            onChange={(e) => updateField("website_binance_pay_id", e.target.value)}
          />
          <input
            className="input"
            placeholder="Website admin contact"
            value={values.website_admin_contact || ""}
            onChange={(e) => updateField("website_admin_contact", e.target.value)}
          />
          <div className="form-section">
            <div className="section-title">Liên hệ hỗ trợ Website</div>
            <p className="muted" style={{ marginBottom: 10 }}>
              Mỗi dòng 1 liên hệ theo format: Tên|Link.
            </p>
            <textarea
              className="textarea"
              placeholder={"Telegram|https://t.me/your_admin\nFacebook|https://facebook.com/your_page\nZalo|https://zalo.me/0900000000"}
              value={values.website_support_contacts || ""}
              onChange={(e) => updateField("website_support_contacts", e.target.value)}
            />
          </div>
          <div className="form-section">
            <div className="section-title">Phân trang sản phẩm Website</div>
            <input
              className="input"
              type="number"
              min={1}
              max={50}
              placeholder="Ví dụ: 10"
              value={values.website_shop_page_size || "10"}
              onChange={(e) => updateField("website_shop_page_size", e.target.value)}
            />
          </div>
          <select
            className="select"
            value={values.website_payment_mode || "hybrid"}
            onChange={(e) => updateField("website_payment_mode", e.target.value)}
          >
            <option value="direct">Thanh toán VietQR luôn</option>
            <option value="hybrid">Thiếu balance thì VietQR</option>
            <option value="balance">Chỉ mua bằng balance</option>
          </select>

          <div className="form-section">
            <div className="section-title">Banner Giữa</div>
            <p className="muted" style={{ marginBottom: 10 }}>
              Có thể thêm/xóa nhiều banner giữa. Website sẽ auto-swipe khi có hơn 1 banner.
            </p>
            <div className="grid" style={{ gap: 10 }}>
              {middleBanners.map((banner, index) => (
                <div key={banner.id} className="card" style={{ padding: 12, boxShadow: "none" }}>
                  <div className="section-title" style={{ fontSize: 14, marginBottom: 8 }}>
                    Banner Giữa #{index + 1}
                  </div>
                  <div className="grid" style={{ gap: 8 }}>
                    <input
                      className="input"
                      placeholder="URL ảnh banner giữa"
                      value={banner.image_url}
                      onChange={(e) => updateMiddleBanner(banner.id, "image_url", e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Link click (https://...)"
                      value={banner.link}
                      onChange={(e) => updateMiddleBanner(banner.id, "link", e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    style={{ marginTop: 10 }}
                    onClick={() => removeMiddleBanner(banner.id)}
                  >
                    Xóa banner
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="button secondary" style={{ marginTop: 10 }} onClick={addMiddleBanner}>
              Thêm Banner Giữa
            </button>
          </div>

          <div className="form-section">
            <div className="section-title">Banner Quảng cáo</div>
            <p className="muted" style={{ marginBottom: 10 }}>
              Set ảnh + link click cho 2 banner hai bên màn hình.
            </p>
            <input
              className="input"
              placeholder="Banner Quảng cáo trái (URL ảnh)"
              value={values.website_banner_ads_left_url || ""}
              onChange={(e) => updateField("website_banner_ads_left_url", e.target.value)}
            />
            <input
              className="input"
              placeholder="Link click banner trái (https://...)"
              value={values.website_banner_ads_left_link || ""}
              onChange={(e) => updateField("website_banner_ads_left_link", e.target.value)}
            />
            <input
              className="input"
              placeholder="Banner Quảng cáo phải (URL ảnh)"
              value={values.website_banner_ads_right_url || ""}
              onChange={(e) => updateField("website_banner_ads_right_url", e.target.value)}
            />
            <input
              className="input"
              placeholder="Link click banner phải (https://...)"
              value={values.website_banner_ads_right_link || ""}
              onChange={(e) => updateField("website_banner_ads_right_link", e.target.value)}
            />
          </div>

          <div className="form-section">
            <div className="section-title">Banner Ứng dụng</div>
            <p className="muted" style={{ marginBottom: 10 }}>
              Có thể thêm/xóa banner ứng dụng. Website mặc định hiển thị 4 banner, nếu nhiều hơn sẽ cho swipe trái/phải.
            </p>
            <label className="toggle" style={{ marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={values.website_show_app_banners !== "false"}
                onChange={(e) => updateField("website_show_app_banners", e.target.checked ? "true" : "false")}
              />
              <span>Hiển thị Banner Ứng dụng trên Website</span>
            </label>
            <div className="grid" style={{ gap: 10 }}>
              {appBanners.map((banner, index) => (
                <div key={banner.id} className="card" style={{ padding: 12, boxShadow: "none" }}>
                  <div className="section-title" style={{ fontSize: 14, marginBottom: 8 }}>
                    Banner Ứng dụng #{index + 1}
                  </div>
                  <div className="grid" style={{ gap: 8 }}>
                    <input
                      className="input"
                      placeholder="URL ảnh banner"
                      value={banner.image_url}
                      onChange={(e) => updateAppBanner(banner.id, "image_url", e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Tiêu đề"
                      value={banner.title}
                      onChange={(e) => updateAppBanner(banner.id, "title", e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Mô tả ngắn"
                      value={banner.subtitle}
                      onChange={(e) => updateAppBanner(banner.id, "subtitle", e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="Link click (https://...)"
                      value={banner.link}
                      onChange={(e) => updateAppBanner(banner.id, "link", e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    style={{ marginTop: 10 }}
                    onClick={() => removeAppBanner(banner.id)}
                  >
                    Xóa banner
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="button secondary" style={{ marginTop: 10 }} onClick={addAppBanner}>
              Thêm Banner Ứng dụng
            </button>
          </div>

          <div className="form-section">
            <div className="section-title">Thống kê Hero</div>
            <p className="muted" style={{ marginBottom: 10 }}>
              Có thể ẩn cả khối thống kê hoặc ẩn từng box nhỏ.
            </p>
            <label className="toggle">
              <input
                type="checkbox"
                checked={values.website_show_stats_section !== "false"}
                onChange={(e) => updateField("website_show_stats_section", e.target.checked ? "true" : "false")}
              />
              <span>Hiển thị toàn bộ khối Stats</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={values.website_show_stats_feedback !== "false"}
                onChange={(e) => updateField("website_show_stats_feedback", e.target.checked ? "true" : "false")}
              />
              <span>Hiển thị box Feedback Rating</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={values.website_show_stats_sold !== "false"}
                onChange={(e) => updateField("website_show_stats_sold", e.target.checked ? "true" : "false")}
              />
              <span>Hiển thị box Products Sold</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={values.website_show_stats_customers !== "false"}
                onChange={(e) => updateField("website_show_stats_customers", e.target.checked ? "true" : "false")}
              />
              <span>Hiển thị box Total Customers</span>
            </label>
          </div>

          <div className="form-section">
            <div className="section-title">FAQ (CRUD)</div>
            <p className="muted" style={{ marginBottom: 10 }}>
              Thêm / sửa / xóa FAQ hiển thị ở Website.
            </p>
            <div className="grid" style={{ gap: 10 }}>
              {faqItems.map((item, index) => (
                <div key={item.id} className="card" style={{ padding: 12, boxShadow: "none" }}>
                  <div className="section-title" style={{ fontSize: 14, marginBottom: 8 }}>
                    FAQ #{index + 1}
                  </div>
                  <label className="toggle" style={{ marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => updateFaqItem(item.id, "enabled", e.target.checked)}
                    />
                    <span>Hiển thị mục FAQ này</span>
                  </label>
                  <input
                    className="input"
                    placeholder="Câu hỏi"
                    value={item.question}
                    onChange={(e) => updateFaqItem(item.id, "question", e.target.value)}
                  />
                  <textarea
                    className="textarea"
                    placeholder="Câu trả lời"
                    value={item.answer}
                    onChange={(e) => updateFaqItem(item.id, "answer", e.target.value)}
                  />
                  <button
                    type="button"
                    className="button secondary"
                    style={{ marginTop: 10 }}
                    onClick={() => removeFaqItem(item.id)}
                  >
                    Xóa FAQ
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="button secondary" style={{ marginTop: 10 }} onClick={addFaqItem}>
              Thêm FAQ
            </button>
          </div>

          <button className="button" type="submit">Lưu Website Settings</button>
          {message && (
            <p className="muted form-section" style={{ marginTop: 0 }}>
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
