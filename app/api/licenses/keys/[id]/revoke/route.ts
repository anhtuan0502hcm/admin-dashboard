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

  const { data, error } = await adminSession.supabase
    .from("license_keys")
    .update({ status: "revoked" })
    .eq("id", licenseKeyId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message || "Không thể revoke key." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Không tìm thấy license key." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { ok: true } });
}
