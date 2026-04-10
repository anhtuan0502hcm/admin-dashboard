export const LICENSE_RECHECK_INTERVAL_SECONDS = 6 * 60 * 60;

export type LicensePublicStatus =
  | "active"
  | "expired"
  | "revoked"
  | "extension_disabled"
  | "fingerprint_mismatch"
  | "not_found";

export type LicenseKeyAdminStatus = "active" | "expired" | "revoked";
export type LicenseKeyDeviceLimitMode = "single_device" | "unlimited_devices";

export type LicenseActivationAdminStatus =
  | "active"
  | "expired"
  | "revoked"
  | "reset"
  | "extension_disabled";

export type LicenseExtensionRecord = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  keyCount: number;
  activeKeyCount: number;
  activeActivationCount: number;
};

export type LicenseKeyActivationSummary = {
  id: number;
  fingerprint: string;
  activatedAt: string;
  lastCheckedAt: string;
  lastVersion: string | null;
};

export type LicenseKeyRecord = {
  id: number;
  extensionId: number;
  extensionCode: string;
  extensionName: string;
  maskedKey: string;
  keyPrefix: string;
  keySuffix: string;
  status: LicenseKeyAdminStatus;
  storedStatus: "active" | "expired" | "revoked";
  expiresAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deviceLimitMode: LicenseKeyDeviceLimitMode;
  activeActivationCount: number;
  activeActivations: LicenseKeyActivationSummary[];
  activeActivation: LicenseKeyActivationSummary | null;
};

export type LicenseActivationRecord = {
  id: number;
  licenseKeyId: number;
  extensionId: number;
  extensionCode: string;
  extensionName: string;
  maskedKey: string;
  fingerprint: string;
  status: LicenseActivationAdminStatus;
  keyStatus: LicenseKeyAdminStatus;
  activatedAt: string;
  lastCheckedAt: string;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  lastIp: string | null;
  lastUserAgent: string | null;
  lastVersion: string | null;
  expiresAt: string;
};

export type LicensePublicResponse = {
  valid: boolean;
  status: LicensePublicStatus;
  activationToken?: string;
  expiresAt?: string | null;
  nextCheckAfterSeconds: number;
};
