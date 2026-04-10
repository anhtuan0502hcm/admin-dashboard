"use client";

import { supabase } from "@/lib/supabaseClient";
import type {
  LicenseActivationRecord,
  LicenseExtensionRecord,
  LicenseKeyAdminStatus,
  LicenseKeyDeviceLimitMode,
  LicenseKeyRecord
} from "@/lib/licenseTypes";

type AdminResponse<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

const getAccessToken = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Chưa đăng nhập.");
  }
  return token;
};

async function requestAdminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as AdminResponse<T> | null;
  if (!response.ok) {
    throw new Error(payload?.error || "Không thể tải dữ liệu.");
  }

  return payload?.data as T;
}

export const fetchLicenseExtensions = () =>
  requestAdminApi<LicenseExtensionRecord[]>("/api/licenses/extensions");

export const saveLicenseExtension = (payload: {
  id?: number;
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  action?: "save" | "delete";
}) =>
  requestAdminApi<{ ok: true; id?: number }>("/api/licenses/extensions", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const fetchLicenseKeys = (filters?: {
  extensionId?: number | null;
  status?: LicenseKeyAdminStatus | "all";
}) => {
  const params = new URLSearchParams();
  if (filters?.extensionId) {
    params.set("extensionId", String(filters.extensionId));
  }
  if (filters?.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return requestAdminApi<LicenseKeyRecord[]>(`/api/licenses/keys${suffix}`);
};

export const saveLicenseKey = (payload: {
  id?: number;
  extensionId?: number;
  expiresAt?: string;
  note?: string;
  deviceLimitMode?: LicenseKeyDeviceLimitMode;
}) =>
  requestAdminApi<{ ok: true; id: number; rawKey?: string; maskedKey?: string; prunedActivationCount?: number }>(
    "/api/licenses/keys",
    {
    method: "POST",
    body: JSON.stringify(payload)
    }
  );

export const revokeLicenseKey = (id: number) =>
  requestAdminApi<{ ok: true }>(`/api/licenses/keys/${id}/revoke`, {
    method: "POST"
  });

export const reactivateLicenseKey = (id: number) =>
  requestAdminApi<{ ok: true }>(`/api/licenses/keys/${id}/reactivate`, {
    method: "POST"
  });

export const resetLicenseKeyActivation = (id: number) =>
  requestAdminApi<{ ok: true }>(`/api/licenses/keys/${id}/reset-activation`, {
    method: "POST"
  });

export const fetchLicenseActivations = (filters?: {
  extensionId?: number | null;
  activeOnly?: boolean;
}) => {
  const params = new URLSearchParams();
  if (filters?.extensionId) {
    params.set("extensionId", String(filters.extensionId));
  }
  if (filters?.activeOnly) {
    params.set("activeOnly", "true");
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return requestAdminApi<LicenseActivationRecord[]>(`/api/licenses/activations${suffix}`);
};

export const resetLicenseActivation = (id: number) =>
  requestAdminApi<{ ok: true; alreadyReset?: boolean }>(`/api/licenses/activations/${id}/reset`, {
    method: "POST"
  });
