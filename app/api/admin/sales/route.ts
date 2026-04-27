import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";
import { getSupabaseAdminClient } from "@/app/api/_shared/supabaseAdmin";
import { recordAdminAuditEvent } from "@/app/api/_shared/adminAudit";

const DEFAULT_SALE_CUSTOM_EMOJI_ID = "6055192572056309981";

const toPositiveInt = (value: unknown, fallback: number | null = null) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toOptionalPositiveInt = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toNonNegativeInt = (value: unknown, fallback = 0) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const cleanText = (value: unknown, fallback = "") =>
  String(value ?? fallback).replace(/\s+/g, " ").trim();

const cleanMultilineStock = (value: unknown) => {
  const raw = String(value ?? "");
  return Array.from(
    new Set(raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))
  );
};

const safeDate = (value: unknown) => {
  const parsed = new Date(String(value ?? ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
};

async function fetchProducts(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  const rpc = await supabase.rpc("get_products_with_stock");
  if (!rpc.error && Array.isArray(rpc.data)) {
    return rpc.data;
  }

  const { data, error } = await supabase
    .from("products")
    .select("id,name,price,price_usdt,telegram_icon,telegram_icon_custom_emoji_id,is_hidden,is_deleted")
    .order("id");
  if (error) throw error;
  return data ?? [];
}

async function getCampaign(supabase: ReturnType<typeof getSupabaseAdminClient>, campaignId: number) {
  const { data, error } = await supabase
    .from("sale_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function assertNoProductTimeConflict(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  productId: number,
  startsAt: string,
  endsAt: string,
  exceptCampaignId?: number
) {
  const { data: items, error: itemError } = await supabase
    .from("sale_items")
    .select("id,campaign_id")
    .eq("product_id", productId)
    .eq("is_enabled", true);
  if (itemError) throw itemError;
  const campaignIds = Array.from(new Set((items ?? []).map((item) => item.campaign_id).filter(Boolean)));
  if (!campaignIds.length) return;

  let query = supabase
    .from("sale_campaigns")
    .select("id,name,status,starts_at,ends_at")
    .in("id", campaignIds)
    .in("status", ["scheduled", "active"])
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt);
  if (exceptCampaignId) query = query.neq("id", exceptCampaignId);
  const { data: conflicts, error } = await query;
  if (error) throw error;
  if (conflicts?.length) {
    throw new Error(`Sản phẩm đã nằm trong Sale chồng thời gian: ${conflicts[0].name || `#${conflicts[0].id}`}.`);
  }
}

async function reserveExistingStock(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  productId: number,
  saleItemId: number,
  quantity: number
) {
  const fetchLimit = Math.min(Math.max(quantity * 3, quantity + 50), 5000);
  const { data: stockRows, error: stockError } = await supabase
    .from("stock")
    .select("id")
    .eq("product_id", productId)
    .eq("sold", false)
    .order("id")
    .limit(fetchLimit);
  if (stockError) throw stockError;

  const stockIds = (stockRows ?? []).map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
  if (!stockIds.length) throw new Error("Sản phẩm không còn stock chưa bán.");

  const { data: reservedRows, error: reservedError } = await supabase
    .from("sale_stock_reservations")
    .select("stock_id")
    .in("stock_id", stockIds)
    .is("released_at", null)
    .in("status", ["available", "held", "sold"]);
  if (reservedError) throw reservedError;

  const reservedIds = new Set((reservedRows ?? []).map((row) => Number(row.stock_id)));
  const availableIds = stockIds.filter((id) => !reservedIds.has(id)).slice(0, quantity);
  if (availableIds.length < quantity) {
    throw new Error(`Không đủ stock trống để đưa vào Sale. Cần ${quantity}, hiện chọn được ${availableIds.length}.`);
  }

  const { error } = await supabase.from("sale_stock_reservations").insert(
    availableIds.map((stockId) => ({
      sale_item_id: saleItemId,
      stock_id: stockId,
      status: "available"
    }))
  );
  if (error) throw error;
  return availableIds.length;
}

export async function GET(request: NextRequest) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) return adminSession.response;

  const supabase = getSupabaseAdminClient();
  try {
    const [campaignsResult, itemsResult, reservationsResult, products] = await Promise.all([
      supabase.from("sale_campaigns").select("*").order("starts_at", { ascending: false }),
      supabase.from("sale_items").select("*,products(id,name,price,price_usdt,telegram_icon,telegram_icon_custom_emoji_id)").order("created_at", { ascending: false }),
      supabase.from("sale_stock_reservations").select("sale_item_id,status,held_until,released_at").limit(20000),
      fetchProducts(supabase)
    ]);

    if (campaignsResult.error) throw campaignsResult.error;
    if (itemsResult.error) throw itemsResult.error;
    if (reservationsResult.error) throw reservationsResult.error;

    const reservationStats = new Map<number, { available: number; held: number; sold: number; released: number }>();
    const now = Date.now();
    for (const row of reservationsResult.data ?? []) {
      const saleItemId = Number(row.sale_item_id);
      if (!Number.isFinite(saleItemId)) continue;
      const stats = reservationStats.get(saleItemId) ?? { available: 0, held: 0, sold: 0, released: 0 };
      const status = String(row.status || "");
      if (status === "held" && row.held_until && new Date(row.held_until).getTime() <= now) {
        stats.available += 1;
      } else if (status === "available") {
        stats.available += 1;
      } else if (status === "held") {
        stats.held += 1;
      } else if (status === "sold") {
        stats.sold += 1;
      } else {
        stats.released += 1;
      }
      reservationStats.set(saleItemId, stats);
    }

    const items = (itemsResult.data ?? []).map((item) => ({
      ...item,
      reservation_stats: reservationStats.get(Number(item.id)) ?? { available: 0, held: 0, sold: 0, released: 0 }
    }));

    return NextResponse.json({
      success: true,
      data: {
        campaigns: campaignsResult.data ?? [],
        items,
        products
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tải Sale." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) return adminSession.response;

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  const supabase = getSupabaseAdminClient();

  try {
    if (action === "create_campaign") {
      const name = cleanText(body?.name);
      const startsAt = safeDate(body?.startsAt);
      const endsAt = safeDate(body?.endsAt);
      if (!name) return NextResponse.json({ error: "Tên campaign không được trống." }, { status: 400 });
      if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
        return NextResponse.json({ error: "Thời gian Sale không hợp lệ." }, { status: 400 });
      }
      const status = ["draft", "scheduled", "active"].includes(String(body?.status)) ? String(body.status) : "scheduled";
      const payload = {
        name,
        status,
        starts_at: startsAt,
        ends_at: endsAt,
        timezone: cleanText(body?.timezone, "Asia/Ho_Chi_Minh") || "Asia/Ho_Chi_Minh",
        default_telegram_icon: cleanText(body?.telegramIcon, "SALE") || "SALE",
        default_telegram_icon_custom_emoji_id: cleanText(body?.telegramIconCustomEmojiId, DEFAULT_SALE_CUSTOM_EMOJI_ID) || DEFAULT_SALE_CUSTOM_EMOJI_ID,
        total_quantity_limit: toOptionalPositiveInt(body?.totalQuantityLimit),
        per_user_limit: toOptionalPositiveInt(body?.perUserLimit),
        notify_on_start: Boolean(body?.notifyOnStart),
        notify_ending_soon: Boolean(body?.notifyEndingSoon),
        notes: cleanText(body?.notes)
      };
      const { data, error } = await supabase.from("sale_campaigns").insert(payload).select("*").single();
      if (error) throw error;
      await recordAdminAuditEvent(supabase, {
        adminUserId: adminSession.userId,
        adminEmail: adminSession.email,
        action: "sale_campaign.create",
        entityType: "sale_campaign",
        entityId: data.id,
        metadata: { status }
      });
      return NextResponse.json({ success: true, data });
    }

    if (action === "set_campaign_status") {
      const campaignId = toPositiveInt(body?.campaignId);
      const status = cleanText(body?.status).toLowerCase();
      if (!campaignId) return NextResponse.json({ error: "campaignId không hợp lệ." }, { status: 400 });
      if (!["draft", "scheduled", "active", "paused", "ended", "cancelled"].includes(status)) {
        return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 400 });
      }
      const { error } = await supabase.from("sale_campaigns").update({ status }).eq("id", campaignId);
      if (error) throw error;
      await recordAdminAuditEvent(supabase, {
        adminUserId: adminSession.userId,
        adminEmail: adminSession.email,
        action: "sale_campaign.set_status",
        entityType: "sale_campaign",
        entityId: campaignId,
        metadata: { status }
      });
      return NextResponse.json({ success: true, data: { campaignId, status } });
    }

    if (action === "add_item_existing_stock" || action === "add_item_new_stock") {
      const campaignId = toPositiveInt(body?.campaignId);
      const productId = toPositiveInt(body?.productId);
      const salePriceVnd = toNonNegativeInt(body?.salePriceVnd, -1);
      const salePriceUsdt = body?.salePriceUsdt === "" || body?.salePriceUsdt == null ? null : Number(body.salePriceUsdt);
      const stockQuantity = toPositiveInt(body?.stockQuantity, null);
      if (!campaignId || !productId) return NextResponse.json({ error: "Campaign hoặc sản phẩm không hợp lệ." }, { status: 400 });
      if (salePriceVnd < 0) return NextResponse.json({ error: "Giá Sale không hợp lệ." }, { status: 400 });

      const campaign = await getCampaign(supabase, campaignId);
      if (!campaign) return NextResponse.json({ error: "Campaign không tồn tại." }, { status: 404 });
      await assertNoProductTimeConflict(supabase, productId, campaign.starts_at, campaign.ends_at, campaignId);

      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id,name,price,price_usdt,description,format_data")
        .eq("id", productId)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) return NextResponse.json({ error: "Sản phẩm không tồn tại." }, { status: 404 });

      const newStockContents = action === "add_item_new_stock" ? cleanMultilineStock(body?.newStockText) : [];
      const reservationCount = action === "add_item_new_stock" ? newStockContents.length : Number(stockQuantity || 0);
      if (reservationCount <= 0) return NextResponse.json({ error: "Số lượng stock Sale phải lớn hơn 0." }, { status: 400 });
      if (reservationCount > 5000) return NextResponse.json({ error: "Tối đa 5.000 stock mỗi lần." }, { status: 400 });

      const discountPercent =
        Number(product.price || 0) > 0
          ? Math.max(0, Math.round((1 - salePriceVnd / Number(product.price || 1)) * 10000) / 100)
          : null;

      const { data: saleItem, error: itemError } = await supabase
        .from("sale_items")
        .insert({
          campaign_id: campaignId,
          product_id: productId,
          sale_name: cleanText(body?.saleName),
          sale_description: cleanText(body?.saleDescription),
          sale_price_vnd: salePriceVnd,
          sale_price_usdt: Number.isFinite(salePriceUsdt as number) ? salePriceUsdt : null,
          original_price_vnd: product.price ?? null,
          original_price_usdt: product.price_usdt ?? null,
          discount_percent: discountPercent,
          promo_buy_quantity: toNonNegativeInt(body?.promoBuyQuantity),
          promo_bonus_quantity: toNonNegativeInt(body?.promoBonusQuantity),
          stock_mode: action === "add_item_new_stock" ? "new_stock" : "reserved_existing",
          quantity_limit: toOptionalPositiveInt(body?.quantityLimit) ?? reservationCount,
          per_user_limit: toOptionalPositiveInt(body?.perUserLimit),
          telegram_icon: cleanText(body?.telegramIcon, "SALE") || "SALE",
          telegram_icon_custom_emoji_id: cleanText(body?.telegramIconCustomEmojiId, DEFAULT_SALE_CUSTOM_EMOJI_ID) || DEFAULT_SALE_CUSTOM_EMOJI_ID,
          sort_position: toOptionalPositiveInt(body?.sortPosition)
        })
        .select("*")
        .single();
      if (itemError) throw itemError;

      try {
        let reserved = 0;
        if (action === "add_item_new_stock") {
          const { data: insertedStock, error: stockInsertError } = await supabase
            .from("stock")
            .insert(newStockContents.map((content) => ({ product_id: productId, content })))
            .select("id");
          if (stockInsertError) throw stockInsertError;
          const stockIds = (insertedStock ?? []).map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
          const { error: reserveError } = await supabase.from("sale_stock_reservations").insert(
            stockIds.map((stockId) => ({ sale_item_id: saleItem.id, stock_id: stockId, status: "available" }))
          );
          if (reserveError) throw reserveError;
          reserved = stockIds.length;
        } else {
          reserved = await reserveExistingStock(supabase, productId, saleItem.id, reservationCount);
        }

        await recordAdminAuditEvent(supabase, {
          adminUserId: adminSession.userId,
          adminEmail: adminSession.email,
          action: action === "add_item_new_stock" ? "sale_item.add_new_stock" : "sale_item.reserve_existing_stock",
          entityType: "sale_item",
          entityId: saleItem.id,
          metadata: { campaignId, productId, reserved }
        });
        return NextResponse.json({ success: true, data: { saleItem, reserved } });
      } catch (error) {
        await supabase.from("sale_items").delete().eq("id", saleItem.id);
        throw error;
      }
    }

    if (action === "set_item_enabled") {
      const saleItemId = toPositiveInt(body?.saleItemId);
      if (!saleItemId) return NextResponse.json({ error: "saleItemId không hợp lệ." }, { status: 400 });
      const enabled = Boolean(body?.enabled);
      const { error } = await supabase.from("sale_items").update({ is_enabled: enabled }).eq("id", saleItemId);
      if (error) throw error;
      await recordAdminAuditEvent(supabase, {
        adminUserId: adminSession.userId,
        adminEmail: adminSession.email,
        action: enabled ? "sale_item.enable" : "sale_item.disable",
        entityType: "sale_item",
        entityId: saleItemId
      });
      return NextResponse.json({ success: true, data: { saleItemId, enabled } });
    }

    return NextResponse.json({ error: "Action không được hỗ trợ." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể cập nhật Sale." },
      { status: 500 }
    );
  }
}
