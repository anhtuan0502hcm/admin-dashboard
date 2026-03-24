import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/api/_shared/supabaseAdmin";
import {
  generateActivationToken,
  getRequestIp,
  normalizeExtensionCode,
  normalizeFingerprint,
  normalizeLicenseKey,
  normalizeOptionalVersion,
  runActivateLicenseRpc
} from "@/app/api/_shared/license";

export async function POST(request: NextRequest) {
  let body: {
    extensionCode?: string;
    licenseKey?: string;
    fingerprint?: string;
    version?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const extensionCode = normalizeExtensionCode(body.extensionCode);
  const licenseKey = normalizeLicenseKey(body.licenseKey);
  const fingerprint = normalizeFingerprint(body.fingerprint);
  const version = normalizeOptionalVersion(body.version);

  if (!extensionCode || !licenseKey || !fingerprint) {
    return NextResponse.json(
      { error: "Thiếu extensionCode, licenseKey hoặc fingerprint hợp lệ." },
      { status: 400 }
    );
  }

  try {
    const activationToken = generateActivationToken();
    const data = await runActivateLicenseRpc(getSupabaseAdminClient(), {
      extensionCode,
      licenseKey,
      fingerprint,
      activationToken,
      ip: getRequestIp(request),
      userAgent: request.headers.get("user-agent"),
      version
    });

    return NextResponse.json({
      success: true,
      data: data.valid
        ? {
            ...data,
            activationToken
          }
        : data
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể kích hoạt license." },
      { status: 500 }
    );
  }
}
