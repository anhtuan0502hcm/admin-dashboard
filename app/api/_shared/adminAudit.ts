import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAuditInput = {
  adminUserId: string;
  adminEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | number | null;
  metadata?: Record<string, unknown>;
};

const sanitizeMetadata = (metadata: Record<string, unknown> | undefined) => {
  if (!metadata) return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lowered = key.toLowerCase();
    if (lowered.includes("token") || lowered.includes("secret") || lowered.includes("password") || lowered.includes("key")) {
      sanitized[key] = "[redacted]";
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
};

export async function recordAdminAuditEvent(
  supabase: SupabaseClient,
  {
    adminUserId,
    adminEmail,
    action,
    entityType,
    entityId,
    metadata
  }: AdminAuditInput
) {
  const actionValue = action.trim();
  if (!actionValue) return;

  const payload = {
    admin_user_id: adminUserId || null,
    admin_email: adminEmail || null,
    action: actionValue,
    entity_type: entityType || null,
    entity_id: entityId == null ? null : String(entityId),
    metadata: sanitizeMetadata(metadata),
    created_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase.from("admin_audit_logs").insert(payload);
    if (error) {
      console.warn("admin audit log skipped:", error.message);
    }
  } catch (error) {
    console.warn("admin audit log skipped:", error);
  }
}
