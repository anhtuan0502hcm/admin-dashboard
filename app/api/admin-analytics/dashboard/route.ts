import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";
import { getDashboardSnapshot } from "@/app/api/_shared/adminAnalytics";

export async function GET(request: NextRequest) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  try {
    const data = await getDashboardSnapshot(adminSession.supabase);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Không thể tải dashboard analytics."
      },
      { status: 500 }
    );
  }
}
