import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";
import { listLicenseActivations } from "@/app/api/_shared/license";

const toPositiveInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function GET(request: NextRequest) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  const extensionId = toPositiveInt(request.nextUrl.searchParams.get("extensionId"));
  const activeOnly = request.nextUrl.searchParams.get("activeOnly") === "true";

  try {
    const data = await listLicenseActivations(adminSession.supabase, {
      extensionId,
      activeOnly
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tải danh sách activation." },
      { status: 500 }
    );
  }
}
