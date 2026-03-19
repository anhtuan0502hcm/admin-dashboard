import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";
import { getUsersSnapshot } from "@/app/api/_shared/adminAnalytics";

export async function GET(request: NextRequest) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  const pageParam = Number(request.nextUrl.searchParams.get("page"));
  const pageSizeParam = Number(request.nextUrl.searchParams.get("pageSize"));
  const search = request.nextUrl.searchParams.get("q") || "";
  const page = Number.isFinite(pageParam) ? pageParam : 1;
  const pageSize = Number.isFinite(pageSizeParam) ? pageSizeParam : 50;

  try {
    const data = await getUsersSnapshot(adminSession.supabase, {
      page,
      pageSize,
      search
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Không thể tải users analytics."
      },
      { status: 500 }
    );
  }
}
