import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";
import { getSupabaseAdminClient } from "@/app/api/_shared/supabaseAdmin";
import { recordAdminAuditEvent } from "@/app/api/_shared/adminAudit";

const toPositiveId = (value: unknown) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export async function POST(request: NextRequest) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  const supabase = getSupabaseAdminClient();

  try {
    if (action === "soft_delete") {
      const productId = toPositiveId(body?.productId);
      if (!productId) return NextResponse.json({ error: "productId không hợp lệ." }, { status: 400 });
      const { error } = await supabase
        .from("products")
        .update({ is_deleted: true, is_hidden: true, deleted_at: new Date().toISOString() })
        .eq("id", productId);
      if (error) throw error;
      await recordAdminAuditEvent(supabase, {
        adminUserId: adminSession.userId,
        adminEmail: adminSession.email,
        action: "product.soft_delete",
        entityType: "product",
        entityId: productId
      });
      return NextResponse.json({ success: true, data: { productId } });
    }

    if (action === "restore") {
      const productId = toPositiveId(body?.productId);
      if (!productId) return NextResponse.json({ error: "productId không hợp lệ." }, { status: 400 });
      const { error } = await supabase
        .from("products")
        .update({ is_deleted: false, is_hidden: false, deleted_at: null })
        .eq("id", productId);
      if (error) throw error;
      await recordAdminAuditEvent(supabase, {
        adminUserId: adminSession.userId,
        adminEmail: adminSession.email,
        action: "product.restore",
        entityType: "product",
        entityId: productId
      });
      return NextResponse.json({ success: true, data: { productId } });
    }

    if (action === "toggle_hidden") {
      const productId = toPositiveId(body?.productId);
      if (!productId) return NextResponse.json({ error: "productId không hợp lệ." }, { status: 400 });
      const hidden = Boolean(body?.hidden);
      const { error } = await supabase.from("products").update({ is_hidden: hidden }).eq("id", productId);
      if (error) throw error;
      await recordAdminAuditEvent(supabase, {
        adminUserId: adminSession.userId,
        adminEmail: adminSession.email,
        action: hidden ? "product.hide" : "product.unhide",
        entityType: "product",
        entityId: productId
      });
      return NextResponse.json({ success: true, data: { productId, hidden } });
    }

    if (action === "delete_folder") {
      const folderId = toPositiveId(body?.folderId);
      if (!folderId) return NextResponse.json({ error: "folderId không hợp lệ." }, { status: 400 });
      const { error: unassignError } = await supabase
        .from("products")
        .update({ bot_folder_id: null })
        .eq("bot_folder_id", folderId);
      if (unassignError) throw unassignError;
      const { error } = await supabase.from("bot_product_folders").delete().eq("id", folderId);
      if (error) throw error;
      await recordAdminAuditEvent(supabase, {
        adminUserId: adminSession.userId,
        adminEmail: adminSession.email,
        action: "product_folder.delete",
        entityType: "bot_product_folder",
        entityId: folderId
      });
      return NextResponse.json({ success: true, data: { folderId } });
    }

    return NextResponse.json({ error: "Action không được hỗ trợ." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể cập nhật sản phẩm." },
      { status: 500 }
    );
  }
}
