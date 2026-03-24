import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/api/_shared/supabaseAdmin";
import {
  getRequestIp,
  normalizeExtensionCode,
  normalizeFingerprint,
  normalizeOptionalVersion,
  normalizeOptionalText,
  runValidateLicenseRpc
} from "@/app/api/_shared/license";

export async function POST(request: NextRequest) {
  let body: {
    extensionCode?: string;
    activationToken?: string;
    fingerprint?: string;
    version?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const extensionCode = normalizeExtensionCode(body.extensionCode);
  const activationToken = normalizeOptionalText(body.activationToken, 512);
  const fingerprint = normalizeFingerprint(body.fingerprint);
  const version = normalizeOptionalVersion(body.version);

  if (!extensionCode || !activationToken || !fingerprint) {
    return NextResponse.json(
      { error: "Thiếu extensionCode, activationToken hoặc fingerprint hợp lệ." },
      { status: 400 }
    );
  }

  try {
    const data = await runValidateLicenseRpc(getSupabaseAdminClient(), {
      extensionCode,
      activationToken,
      fingerprint,
      ip: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      version
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể xác thực license." },
      { status: 500 }
    );
  }
}
