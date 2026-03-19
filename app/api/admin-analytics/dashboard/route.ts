import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";
import { getDashboardSnapshot } from "@/app/api/_shared/adminAnalytics";
import { getOrSetServerCache } from "@/app/api/_shared/serverCache";
import { buildServerTimingHeader } from "@/app/api/_shared/serverTiming";

const DASHBOARD_CACHE_TTL_MS = 15_000;

export async function GET(request: NextRequest) {
  const routeStartedAt = performance.now();
  const adminSession = await requireAdminSession(request);
  const authDuration = performance.now() - routeStartedAt;
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  try {
    const analyticsStartedAt = performance.now();
    const { value: data, hit } = await getOrSetServerCache("admin-analytics:dashboard:v2", DASHBOARD_CACHE_TTL_MS, () =>
      getDashboardSnapshot(adminSession.supabase)
    );
    const analyticsDuration = performance.now() - analyticsStartedAt;
    const response = NextResponse.json({ success: true, data });
    response.headers.set(
      "Server-Timing",
      buildServerTimingHeader([
        { name: "auth", duration: authDuration },
        { name: "analytics", duration: analyticsDuration, description: hit ? "cache-hit" : "cache-miss" },
        { name: "total", duration: performance.now() - routeStartedAt }
      ])
    );
    response.headers.set("X-Admin-Analytics-Cache", hit ? "hit" : "miss");
    return response;
  } catch (error) {
    const response = NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "Không thể tải dashboard analytics."
      },
      { status: 500 }
    );
    response.headers.set(
      "Server-Timing",
      buildServerTimingHeader([
        { name: "auth", duration: authDuration },
        { name: "total", duration: performance.now() - routeStartedAt, description: "error" }
      ])
    );
    return response;
  }
}
