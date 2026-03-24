import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";

const parseRouteId = (value: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  const licenseKeyId = parseRouteId(context.params.id);
  if (!licenseKeyId) {
    return NextResponse.json({ error: "License key id không hợp lệ." }, { status: 400 });
  }

  const { data: existingRow, error: existingError } = await adminSession.supabase
    .from("license_keys")
    .select("id")
    .eq("id", licenseKeyId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message || "Không thể tải license key." }, { status: 500 });
  }

  if (!existingRow) {
    return NextResponse.json({ error: "Không tìm thấy license key." }, { status: 404 });
  }

  const { error } = await adminSession.supabase
    .from("license_activations")
    .update({
      deactivated_at: new Date().toISOString(),
      deactivation_reason: "admin_reset"
    })
    .eq("license_key_id", licenseKeyId)
    .is("deactivated_at", null);

  if (error) {
    return NextResponse.json({ error: error.message || "Không thể reset activation." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { ok: true } });
}
