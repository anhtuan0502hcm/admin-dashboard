import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/app/api/_shared/adminAuth";
import { listLicenseExtensions, normalizeExtensionCode, normalizeOptionalText } from "@/app/api/_shared/license";

const toPositiveInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isDuplicateError = (message: string) => {
  const lowered = message.toLowerCase();
  return lowered.includes("duplicate key") || lowered.includes("already exists");
};

export async function GET(request: NextRequest) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  try {
    const data = await listLicenseExtensions(adminSession.supabase);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tải danh sách extension." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const adminSession = await requireAdminSession(request);
  if (adminSession.ok === false) {
    return adminSession.response;
  }

  let body: {
    id?: number;
    code?: string;
    name?: string;
    description?: string;
    isActive?: boolean;
    action?: "save" | "delete";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const action = body.action === "delete" ? "delete" : "save";
  const extensionId = toPositiveInt(body.id);

  if (action === "delete") {
    if (!extensionId) {
      return NextResponse.json({ error: "Thiếu extension id hợp lệ." }, { status: 400 });
    }

    const { count, error: countError } = await adminSession.supabase
      .from("license_keys")
      .select("id", { count: "exact", head: true })
      .eq("extension_id", extensionId);

    if (countError) {
      return NextResponse.json({ error: countError.message || "Không thể kiểm tra license keys." }, { status: 500 });
    }

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: "Không thể xóa extension đang có license key." },
        { status: 409 }
      );
    }

    const { error } = await adminSession.supabase
      .from("license_extensions")
      .delete()
      .eq("id", extensionId);

    if (error) {
      return NextResponse.json({ error: error.message || "Không thể xóa extension." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { ok: true, id: extensionId } });
  }

  const name = normalizeOptionalText(body.name, 120);
  const description = normalizeOptionalText(body.description, 1000);
  const isActive = body.isActive !== false;

  if (!name) {
    return NextResponse.json({ error: "Tên extension không được để trống." }, { status: 400 });
  }

  if (extensionId) {
    const { data: existingRow, error: existingError } = await adminSession.supabase
      .from("license_extensions")
      .select("id, code")
      .eq("id", extensionId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message || "Không thể tải extension." }, { status: 500 });
    }

    if (!existingRow) {
      return NextResponse.json({ error: "Không tìm thấy extension." }, { status: 404 });
    }

    const nextCode = normalizeExtensionCode(body.code || existingRow.code);
    if (nextCode && nextCode !== existingRow.code) {
      return NextResponse.json({ error: "Code extension là immutable và không thể đổi." }, { status: 409 });
    }

    const { error } = await adminSession.supabase
      .from("license_extensions")
      .update({
        name,
        description,
        is_active: isActive
      })
      .eq("id", extensionId);

    if (error) {
      return NextResponse.json({ error: error.message || "Không thể cập nhật extension." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { ok: true, id: extensionId } });
  }

  const code = normalizeExtensionCode(body.code);
  if (!code) {
    return NextResponse.json({ error: "Code extension không hợp lệ." }, { status: 400 });
  }

  const { data, error } = await adminSession.supabase
    .from("license_extensions")
    .insert({
      code,
      name,
      description,
      is_active: isActive
    })
    .select("id")
    .maybeSingle();

  if (error) {
    const status = isDuplicateError(error.message || "") ? 409 : 500;
    return NextResponse.json(
      { error: status === 409 ? "Code extension đã tồn tại." : error.message || "Không thể tạo extension." },
      { status }
    );
  }

  return NextResponse.json({ success: true, data: { ok: true, id: data?.id } });
}
