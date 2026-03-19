import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";
import {
  DirectOrderFulfillmentError,
  fulfillWebsiteDirectOrder
} from "@/app/api/_shared/directOrderFulfillment";
import { sendPaymentRelayNotification } from "@/app/api/_shared/paymentRelay";

const rawExpireMinutes = Number(process.env.DIRECT_ORDER_PENDING_EXPIRE_MINUTES || "10");
const DIRECT_ORDER_PENDING_EXPIRE_MINUTES = Number.isFinite(rawExpireMinutes)
  ? Math.max(1, rawExpireMinutes)
  : 10;

export async function POST(request: NextRequest) {
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

  const orderGroup = `WEB${Date.now()}`;
  let fulfillment;
  try {
    fulfillment = await fulfillWebsiteDirectOrder(
      adminSession.supabase,
      orderId,
      DIRECT_ORDER_PENDING_EXPIRE_MINUTES,
      orderGroup
    );
  } catch (error) {
    if (error instanceof DirectOrderFulfillmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to fulfill website order." }, { status: 500 });
  }

  const totalPrice = Number(fulfillment.amount || 0);
  const productName = fulfillment.product_name;

  await sendPaymentRelayNotification(adminSession.supabase, [
    "✅ Thanh toán thành công (Duyệt tay Website)",
    `Mã direct order: ${fulfillment.website_direct_order_id}`,
    `Mã website order: ${fulfillment.website_order_id ?? "-"}`,
    `Mã thanh toán: ${fulfillment.code}`,
    `Số tiền: ${totalPrice.toLocaleString("vi-VN")}đ`,
    `Mã user website: ${fulfillment.auth_user_id || "-"}`,
    `Email user: ${fulfillment.user_email || "-"}`,
    `Sản phẩm: ${productName}`,
    `SL thanh toán: ${fulfillment.quantity}`,
    `SL giao: ${fulfillment.items.length}`,
    `SL khuyến mãi: ${fulfillment.bonus_quantity}`
  ]);

  return NextResponse.json({
    success: true,
    fulfilled_order_id: fulfillment.website_order_id
  });
}
