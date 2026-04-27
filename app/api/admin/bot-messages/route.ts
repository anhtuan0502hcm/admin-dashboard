import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";
import { recordAdminAuditEvent } from "@/app/api/_shared/adminAudit";
import { getSupabaseAdminClient } from "@/app/api/_shared/supabaseAdmin";

const LANGUAGE_SET = new Set(["vi", "en"]);
const TEMPLATE_KEY_PATTERN = /^[a-z0-9_.:-]{2,80}$/;

const DEFAULT_BUTTON_LABEL_TEMPLATES = [
  ["reply.shop", "Nút reply Shop", "Reply keyboard button mở danh mục Shop.", "🛒 Mua hàng", "🛒 Shop"],
  ["reply.balance", "Nút reply Số dư", "Reply keyboard button xem số dư.", "💰 Số dư", "💰 Balance"],
  ["reply.deposit", "Nút reply Nạp tiền", "Reply keyboard button tạo lệnh nạp tiền.", "➕ Nạp tiền", "➕ Deposit"],
  ["reply.withdraw", "Nút reply Rút tiền", "Reply keyboard button tạo yêu cầu rút tiền.", "💸 Rút tiền", "💸 Withdraw"],
  ["reply.history", "Nút reply Lịch sử", "Reply keyboard button mở lịch sử mua.", "📜 Lịch sử mua", "📜 History"],
  ["reply.support", "Nút reply Hỗ trợ", "Reply keyboard button mở hỗ trợ.", "💬 Hỗ trợ", "💬 Support"],
  ["reply.language", "Nút reply Ngôn ngữ", "Reply keyboard button đổi ngôn ngữ.", "🌐 Ngôn ngữ", "🌐 Language"],
  ["reply.cancel", "Nút reply Hủy", "Reply keyboard button hủy thao tác.", "❌ Hủy", "❌ Cancel"],
  ["button.delete", "Nút Xóa", "Inline button xóa/ẩn tin nhắn bot.", "🗑 Xóa", "🗑 Delete"],
  ["button.back", "Nút Quay lại", "Inline button quay lại màn trước.", "🔙 Quay lại", "🔙 Back"],
  ["button.back_shop", "Nút quay lại Shop", "Inline button quay lại danh mục Shop.", "🔙 Shop", "🔙 Shop"],
  ["button.back_product", "Nút quay lại sản phẩm", "Inline button quay lại chi tiết sản phẩm.", "🔙 Quay lại sản phẩm", "🔙 Back to product"],
  ["button.refresh", "Nút Cập nhật", "Inline button refresh danh sách.", "🔄 Cập nhật", "🔄 Refresh"],
  ["button.prev", "Nút trang trước", "Inline pagination previous button.", "⬅️ Trước", "⬅️ Prev"],
  ["button.next", "Nút trang sau", "Inline pagination next button.", "Sau ➡️", "Next ➡️"],
  ["button.check_status", "Nút kiểm tra trạng thái", "Inline button kiểm tra trạng thái đơn thanh toán.", "🔄 Kiểm tra trạng thái", "🔄 Check status"],
  ["button.history", "Nút Lịch sử", "Inline button mở lịch sử mua.", "📜 Lịch sử", "📜 History"],
  ["button.support", "Nút Hỗ trợ", "Inline button mở hỗ trợ.", "💬 Hỗ trợ", "💬 Support"],
  ["button.account", "Nút Tài khoản", "Inline button mở thông tin tài khoản.", "👤 Tài khoản", "👤 Account"],
  ["button.open_shop", "Nút mở danh mục", "Inline button mở danh mục Shop.", "🛒 Mở danh mục", "🛒 Open shop"],
  ["button.main_shop", "Nút menu Shop", "Inline main menu Shop button.", "🛒 Mua hàng", "🛒 Shop"],
  ["button.main_deposit", "Nút menu Nạp tiền", "Inline main menu deposit button.", "💰 Nạp tiền", "💰 Deposit"],
  ["button.rebuy", "Nút mua lại", "Inline button mua lại từ lịch sử đơn.", "🛒 Mua lại", "🛒 Buy again"],
  ["button.quick_quantity", "Nút chọn nhanh số lượng", "Inline button quay lại chọn số lượng nhanh.", "⚡ Chọn nhanh", "⚡ Quick pick"],
  ["button.manual_quantity", "Nút nhập tay số lượng", "Inline button nhập số lượng thủ công.", "✍️ Nhập tay", "✍️ Enter manually"],
  ["button.pay_vnd", "Nút ví VNĐ", "Inline button thanh toán bằng ví VNĐ.", "💰 Ví VNĐ", "💰 VND wallet"],
  ["button.pay_usdt", "Nút ví USDT", "Inline button thanh toán bằng ví USDT.", "💵 Ví USDT", "💵 USDT wallet"],
  ["button.vietqr", "Nút VietQR", "Inline button thanh toán VietQR.", "💳 VietQR", "💳 VietQR"],
  ["button.binance", "Nút Binance", "Inline button thanh toán Binance.", "🟡 Binance", "🟡 Binance"]
] as const;

const DEFAULT_BOT_MESSAGE_TEMPLATES = [
  ...DEFAULT_BUTTON_LABEL_TEMPLATES.flatMap(([templateKey, title, description, viText, enText]) => [
    {
      template_key: templateKey,
      language: "vi",
      title,
      description,
      body_text: viText,
      custom_emoji_id: null,
      fallback_emoji: null,
      enabled: true,
      variables: [],
      updated_at: null
    },
    {
      template_key: templateKey,
      language: "en",
      title: `${title} EN`,
      description,
      body_text: enText,
      custom_emoji_id: null,
      fallback_emoji: null,
      enabled: true,
      variables: [],
      updated_at: null
    }
  ]),
  {
    template_key: "sale_entry_button",
    language: "vi",
    title: "Nút vào Sale",
    description: "Nút inline ở đầu danh mục Shop khi có Sale đang mở.",
    body_text: "SALE đang mở",
    custom_emoji_id: "6055192572056309981",
    fallback_emoji: "🔥",
    enabled: true,
    variables: [],
    updated_at: null
  },
  {
    template_key: "sale_entry_button",
    language: "en",
    title: "Sale entry button",
    description: "Inline button at the top of the Shop catalog when Sale is open.",
    body_text: "SALE is open",
    custom_emoji_id: "6055192572056309981",
    fallback_emoji: "🔥",
    enabled: true,
    variables: [],
    updated_at: null
  }
] as const;

const cleanText = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const cleanCustomEmojiId = (value: unknown) =>
  cleanText(value).replace(/\D/g, "").slice(0, 64);

const cleanVariables = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 20);
};

export async function GET(request: NextRequest) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bot_message_templates")
    .select("template_key, language, title, description, body_text, custom_emoji_id, fallback_emoji, enabled, variables, updated_at")
    .order("template_key", { ascending: true })
    .order("language", { ascending: true });

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message ||
          "Không thể tải Bot messages. Hãy chạy supabase_schema_all_in_one.sql để tạo bot_message_templates."
      },
      { status: 500 }
    );
  }

  const rows = data || [];
  const existing = new Set(rows.map((item) => `${item.template_key}:${item.language}`));
  const mergedRows = [
    ...rows,
    ...DEFAULT_BOT_MESSAGE_TEMPLATES.filter((item) => !existing.has(`${item.template_key}:${item.language}`))
  ].sort((left, right) =>
    `${left.template_key}:${left.language}`.localeCompare(`${right.template_key}:${right.language}`)
  );

  return NextResponse.json({ success: true, data: mergedRows });
}

export async function POST(request: NextRequest) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  const body = await request.json().catch(() => null);
  const templateKey = cleanText(body?.templateKey || body?.template_key).toLowerCase();
  const language = cleanText(body?.language, "vi").toLowerCase();
  const title = cleanText(body?.title);
  const bodyText = typeof body?.bodyText === "string" ? body.bodyText.trim() : cleanText(body?.body_text);

  if (!TEMPLATE_KEY_PATTERN.test(templateKey)) {
    return NextResponse.json({ error: "Template key không hợp lệ." }, { status: 400 });
  }
  if (!LANGUAGE_SET.has(language)) {
    return NextResponse.json({ error: "Language không hợp lệ." }, { status: 400 });
  }
  if (!title || !bodyText) {
    return NextResponse.json({ error: "Title và body text là bắt buộc." }, { status: 400 });
  }

  const payload = {
    template_key: templateKey,
    language,
    title,
    description: cleanText(body?.description),
    body_text: bodyText,
    custom_emoji_id: cleanCustomEmojiId(body?.customEmojiId || body?.custom_emoji_id) || null,
    fallback_emoji: cleanText(body?.fallbackEmoji || body?.fallback_emoji) || null,
    enabled: body?.enabled === false ? false : true,
    variables: cleanVariables(body?.variables)
  };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bot_message_templates")
    .upsert(payload, { onConflict: "template_key,language" })
    .select("template_key, language, title, description, body_text, custom_emoji_id, fallback_emoji, enabled, variables, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message || "Không thể lưu Bot message." }, { status: 500 });
  }

  await recordAdminAuditEvent(supabase, {
    adminUserId: adminSession.userId,
    adminEmail: adminSession.email,
    action: "bot_message_template.upsert",
    entityType: "bot_message_template",
    entityId: `${templateKey}:${language}`,
    metadata: {
      templateKey,
      language,
      hasCustomEmoji: Boolean(payload.custom_emoji_id)
    }
  });

  return NextResponse.json({ success: true, data });
}
