import type { SupabaseClient } from "@supabase/supabase-js";

const RELAY_BOT_TOKEN_KEY = "payment_notify_bot_token";
const RELAY_USER_ID_KEY = "payment_notify_user_id";
const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

const parseChatId = (rawValue: string | null | undefined) => {
  const text = String(rawValue || "").trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isInteger(value)) return null;
  return value;
};

export const sendPaymentRelayNotification = async (
  supabase: SupabaseClient,
  messageLines: string[]
) => {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", [RELAY_BOT_TOKEN_KEY, RELAY_USER_ID_KEY]);

    if (error || !data) {
      return false;
    }

    const settingMap = new Map<string, string>();
    for (const row of data as Array<{ key: string; value: string | null }>) {
      settingMap.set(String(row.key || ""), String(row.value || ""));
    }

    const relayToken = String(settingMap.get(RELAY_BOT_TOKEN_KEY) || "").trim();
    const relayChatId = parseChatId(settingMap.get(RELAY_USER_ID_KEY));
    if (!relayToken || relayChatId === null) {
      return false;
    }

    const text = messageLines
      .map((line) => String(line ?? "").trimEnd())
      .join("\n")
      .slice(0, TELEGRAM_MAX_MESSAGE_LENGTH);

    if (!text) return false;

    const response = await fetch(`https://api.telegram.org/bot${relayToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: relayChatId,
        text
      })
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json().catch(() => null);
    return payload?.ok === true;
  } catch {
    return false;
  }
};
