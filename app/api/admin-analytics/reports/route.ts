import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";
import { getReportsSnapshot } from "@/app/api/_shared/adminAnalytics";

export async function GET(request: NextRequest) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  const rawPeriod = request.nextUrl.searchParams.get("period") || "month";
  const period =
    rawPeriod === "today" ||
    rawPeriod === "quarter" ||
    rawPeriod === "custom_month" ||
    rawPeriod === "all_time"
      ? rawPeriod
      : "month";
  const month = request.nextUrl.searchParams.get("month");
  const compareMonth = request.nextUrl.searchParams.get("compareMonth");

  try {
    const data = await getReportsSnapshot(adminSession.supabase, {
      period,
      month,
      compareMonth
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Không thể tải reports analytics."
      },
      { status: 500 }
    );
  }
}
