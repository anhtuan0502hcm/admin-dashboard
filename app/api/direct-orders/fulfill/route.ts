import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";
import {
  DirectOrderFulfillmentError,
  fulfillBotDirectOrder
} from "@/app/api/_shared/directOrderFulfillment";
import { sendPaymentRelayNotification } from "@/app/api/_shared/paymentRelay";

const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const MAX_MESSAGE_LENGTH = 4096;
const rawExpireMinutes = Number(process.env.DIRECT_ORDER_PENDING_EXPIRE_MINUTES || "10");
const DIRECT_ORDER_PENDING_EXPIRE_MINUTES = Number.isFinite(rawExpireMinutes)
  ? Math.max(1, rawExpireMinutes)
  : 10;

const sendTelegramMessage = async (chatId: number, text: string) => {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    })
  });

  if (!response.ok) {
    return false;
  }

  const payload = await response.json();
  return payload.ok === true;
};

const sendTelegramDocument = async (chatId: number, filename: string, content: string, caption: string) => {
  const form = new FormData();
  form.append("chat_id", chatId.toString());
  form.append("caption", caption);
  form.append("document", new Blob([content], { type: "text/plain" }), filename);

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    return false;
  }

  const payload = await response.json();
  return payload.ok === true;
};

const formatDescriptionBlock = (description: string | null | undefined, label = "📝 Mô tả") => {
  if (!description) return "";
  const cleaned = description.toString().trim();
  if (!cleaned) return "";
  return `${label}:\n${cleaned}\n\n`;
};

const buildDisplayName = (user?: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
} | null) => {
  const firstName = String(user?.first_name || "").trim();
  const lastName = String(user?.last_name || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }
  const username = String(user?.username || "").trim().replace(/^@+/, "");
  return username ? `@${username}` : "-";
};

const buildSuccessSummaryText = ({
  productName,
  deliveredQuantity,
  totalText,
  bonusQuantity = 0
}: {
  productName: string;
  deliveredQuantity: number;
  totalText: string;
  bonusQuantity?: number;
}) => {
  const lines = [
    "✅ Thanh toán thành công!",
    "",
    `🧾 Loại hàng: ${productName}`,
    `📦 Số lượng: ${deliveredQuantity}`,
    `💰 Tổng: ${totalText}`
  ];
  if (bonusQuantity > 0) {
    lines.push(`🎁 Tặng thêm: ${bonusQuantity}`);
  }
  return lines.join("\n");
};

const buildFormattedItems = (items: string[], formatData?: string | null, html = false) => {
  const labels = (formatData || "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  if (!labels.length) {
    return items.map((item) => (html ? `<code>${item}</code>` : item));
  }
  return items.map((item) => {
    const values = item.split(",").map((value) => value.trim());
    const lines = labels.map((label, idx) => {
      const value = values[idx] ?? "";
      if (html) {
        return value ? `${label}: <code>${value}</code>` : `${label}:`;
      }
      return value ? `${label}: ${value}` : `${label}:`;
    });
    return lines.join("\n");
  });
};

const buildDeliveryMessageText = ({
  successText,
  items,
  formatData,
  description
}: {
  successText: string;
  items: string[];
  formatData?: string | null;
  description?: string | null;
}) => {
  const descriptionBlock = formatDescriptionBlock(description);
  const itemsFormatted = buildFormattedItems(items, formatData, true).join("\n\n");
  return `${successText}\n\n${descriptionBlock}🔐 Account:\n${itemsFormatted}`.slice(0, MAX_MESSAGE_LENGTH);
};

export async function POST(request: NextRequest) {
  if (!botToken) {
    return NextResponse.json({ error: "BOT_TOKEN missing." }, { status: 500 });
  }

  let body: { orderId?: number | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const orderId = body.orderId ? Number(body.orderId) : null;
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  const orderGroup = `MANUAL${Date.now()}`;
  let fulfillment;
  try {
    fulfillment = await fulfillBotDirectOrder(
      adminSession.supabase,
      orderId,
      DIRECT_ORDER_PENDING_EXPIRE_MINUTES,
      orderGroup
    );
  } catch (error) {
    if (error instanceof DirectOrderFulfillmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fulfill order." }, { status: 500 });
  }

  const productName = fulfillment.product_name;
  const bonusQuantity = Number(fulfillment.bonus_quantity || 0);
  const items = fulfillment.items;
  const totalPrice = Number(fulfillment.amount || 0);
  const { data: userProfile } = await adminSession.supabase
    .from("users")
    .select("first_name, last_name, username")
    .eq("user_id", fulfillment.user_id)
    .maybeSingle();
  const displayName = buildDisplayName(userProfile);

  await sendPaymentRelayNotification(adminSession.supabase, [
    "✅ Thanh toán thành công (Duyệt tay Bot)",
    `Mã đơn hệ thống: ${fulfillment.direct_order_id}`,
    `Mã người dùng: ${fulfillment.user_id}`,
    `Tên người dùng: ${displayName}`,
    `Mã thanh toán: ${fulfillment.code}`,
    "",
    `Số tiền nhận: ${totalPrice.toLocaleString("vi-VN")}đ`,
    `Số tiền kỳ vọng: ${totalPrice.toLocaleString("vi-VN")}đ`,
    "",
    `Sản phẩm: ${productName}`,
    `SL thanh toán: ${fulfillment.quantity}`,
    `SL giao: ${items.length}`,
    `SL khuyến mãi: ${bonusQuantity}`
  ]);

  const description = fulfillment.description || "";
  const totalText = `${totalPrice.toLocaleString("vi-VN")}đ`;
  const successText = buildSuccessSummaryText({
    productName,
    deliveredQuantity: items.length,
    totalText,
    bonusQuantity
  });
  const messageText = buildDeliveryMessageText({
    successText,
    items,
    formatData: fulfillment.format_data,
    description
  });

  let sent = false;
  if (items.length > 5 || messageText.length >= MAX_MESSAGE_LENGTH - 50) {
    const headerLines = [
      `Loại hàng: ${productName}`,
      `Số lượng: ${items.length}`,
      `SL thanh toán: ${fulfillment.quantity}`,
      `Tổng: ${totalText}`
    ];
    if (bonusQuantity > 0) {
      headerLines.push(`Tặng thêm: ${bonusQuantity}`);
    }
    if (description) {
      headerLines.push(`Mô tả: ${description}`);
    }
    const fileItems = buildFormattedItems(items, fulfillment.format_data, false);
    const fileContent = `${headerLines.join("\n")}\n${"=".repeat(40)}\n\n${fileItems.join("\n\n")}`;
    const filename = `${productName}_${items.length}.txt`;
    sent = await sendTelegramDocument(fulfillment.user_id, filename, fileContent, successText);
  } else {
    sent = await sendTelegramMessage(fulfillment.user_id, messageText);
  }

  if (!sent) {
    return NextResponse.json({ error: "Failed to send message." }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
