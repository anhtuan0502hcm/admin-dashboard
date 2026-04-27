import type { SupabaseClient } from "@supabase/supabase-js";

const API_BASE = process.env.STOCK_CUSTOM_CHECK_TEMPMAIL_API_BASE || "https://email.devtai.net/api";
const TINYHOST_API =
  process.env.STOCK_CUSTOM_CHECK_TINYHOST_API_URL ||
  "https://email-inbox-receiver.vercel.app/api/tempmail-tinyhost";
const HOTMAIL_PROXY_URL =
  process.env.STOCK_CUSTOM_CHECK_HOTMAIL_PROXY_URL ||
  "https://email-inbox-receiver.vercel.app/api/read-inbox";
const DEFAULT_HOTMAIL_CLIENT_ID =
  process.env.STOCK_CUSTOM_CHECK_HOTMAIL_CLIENT_ID || "d3590ed6-52b3-4102-aeff-aad2292ab01c";
const DEFAULT_HOTMAIL_AUTH_MODE = "graph";
const DEFAULT_HOTMAIL_MAX_MESSAGES = 20;
const DEFAULT_CONCURRENCY = 20;
const MAX_CONCURRENCY = 50;
const MAX_MAIL_COLUMN_INDEX = 30;
const MAX_SELECTED_STOCK_IDS = 2000;
const MAX_CHECK_ITEMS = 10000;
const STOCK_PAGE_SIZE = 1000;

export type CustomCheckSource = "tempmail" | "tinyhost" | "hotmail";
export type CustomCheckScope = "product" | "selected";
export type CustomCheckStatus = "true" | "false" | "error";

interface StockRow {
  id: number;
  content: string;
}

interface HotmailAccount {
  email: string;
  password: string;
  refreshToken: string;
  clientId: string;
}

export interface CustomCheckResult {
  stock_id: number;
  identifier: string;
  content: string;
  status: CustomCheckStatus;
  error?: string;
}

export interface CustomCheckRequestBody {
  scope?: CustomCheckScope;
  source?: CustomCheckSource;
  senderFilter?: string;
  subjectFilter?: string;
  mailColumnIndex?: number;
  concurrency?: number;
  productId?: number;
  selectedStockIds?: number[];
}

export interface CustomCheckResponseBody {
  total: number;
  true_count: number;
  false_count: number;
  error_count: number;
  results: CustomCheckResult[];
}

export interface CustomCheckExecutionResult {
  ok: boolean;
  status: number;
  error?: string;
  data?: CustomCheckResponseBody;
}

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const looksLikeClientId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );

const parseHotmailAccountLine = (rawLine: string): HotmailAccount | null => {
  const line = String(rawLine || "").trim();
  if (!line) return null;

  const parts = line.split("|").map((part) => part.trim());
  if (parts.length < 2) return null;

  const email = (parts[0] || "").toLowerCase();
  if (!isValidEmail(email)) return null;

  let password = "";
  let refreshToken = "";
  let clientId = "";

  if (parts.length >= 4) {
    password = parts[1] || "";
    refreshToken = parts[2] || "";
    clientId = parts[3] || "";
  } else if (parts.length === 3) {
    const second = parts[1] || "";
    const third = parts[2] || "";
    const secondLooksRefreshToken = second.length > 20;
    const thirdLooksClientId = looksLikeClientId(third);

    if (secondLooksRefreshToken && thirdLooksClientId) {
      refreshToken = second;
      clientId = third;
    } else {
      password = second;
      refreshToken = third;
    }
  } else {
    refreshToken = parts[1] || "";
  }

  if (!refreshToken) return null;

  return {
    email,
    password,
    refreshToken,
    clientId
  };
};

const extractColumnValueFromStockContent = (content: string, mailColumnIndex: number) => {
  const line = String(content || "").trim();
  if (!line) return { value: "", columnCount: 0 };
  const columns = line.split(",").map((part) => part.trim());
  const value = columns[mailColumnIndex - 1] ?? "";
  return {
    value: String(value || "").trim(),
    columnCount: columns.length
  };
};

const extractEmailFromText = (value: string) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (isValidEmail(text)) {
    return text.toLowerCase();
  }
  const matched = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return matched ? matched[0].toLowerCase() : "";
};

const checkIfPaid = (
  messages: Array<{ fromAddress?: string | null; subject?: string | null }>,
  senderFilter: string,
  subjectFilter: string
) => {
  if (!messages || messages.length === 0) return false;

  return messages.some((message) => {
    const fromAddress = String(message?.fromAddress || "").toLowerCase();
    const subject = String(message?.subject || "").toLowerCase();
    const matchesSender = !senderFilter || fromAddress.includes(senderFilter);
    const matchesSubject = !subjectFilter || subject.includes(subjectFilter);
    return matchesSender && matchesSubject;
  });
};

const normalizeTinyhostMessage = (message: Record<string, unknown>) => ({
  subject: String(message.subject || message.title || ""),
  fromAddress: String(
    message.from || message.sender || message.fromAddress || message.from_address || ""
  )
});

const fetchTempMailMessages = async (email: string) => {
  const response = await fetch(`${API_BASE}/email/${encodeURIComponent(email)}`);
  if (!response.ok) {
    throw new Error(`TempMail API error: HTTP ${response.status}`);
  }
  const messages = await response.json();
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages as Array<{ fromAddress?: string; subject?: string }>;
};

const fetchTinyhostMessages = async (email: string) => {
  const response = await fetch(TINYHOST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email })
  });

  let data: Record<string, unknown> | null = null;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`TinyHost API error: HTTP ${response.status}`);
  }

  if (!response.ok || data?.success !== true) {
    const apiError =
      typeof data?.error === "string" && data.error.trim()
        ? data.error
        : `TinyHost API error: HTTP ${response.status}`;
    throw new Error(apiError);
  }

  const rawEmails = Array.isArray(data.emails) ? (data.emails as Record<string, unknown>[]) : [];
  return rawEmails.map(normalizeTinyhostMessage);
};

const fetchHotmailMessages = async (account: HotmailAccount) => {
  const response = await fetch(HOTMAIL_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      hotmail_email: account.email,
      refresh_token: account.refreshToken,
      client_id: account.clientId || DEFAULT_HOTMAIL_CLIENT_ID,
      auth_mode: DEFAULT_HOTMAIL_AUTH_MODE,
      max_messages: DEFAULT_HOTMAIL_MAX_MESSAGES,
      return_all_emails: true
    })
  });

  let data: Record<string, unknown> | null = null;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`Hotmail API error: HTTP ${response.status}`);
  }

  if (!response.ok || data?.success !== true) {
    const apiError =
      typeof data?.error === "string" && data.error.trim()
        ? data.error
        : `Hotmail API error: HTTP ${response.status}`;
    throw new Error(apiError);
  }

  const emails = Array.isArray(data.emails) ? (data.emails as Record<string, unknown>[]) : [];
  return emails.map((email) => ({
    subject: String(email.subject || email.Subject || ""),
    fromAddress: String(
      ((email.from as Record<string, unknown> | undefined)?.emailAddress as
        | Record<string, unknown>
        | undefined)?.address ||
        ((email.From as Record<string, unknown> | undefined)?.EmailAddress as
          | Record<string, unknown>
          | undefined)?.Address ||
        ""
    )
  }));
};

const fetchStocksByProduct = async (client: SupabaseClient, productId: number) => {
  const rows: StockRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from("stock")
      .select("id, content")
      .eq("product_id", productId)
      .order("id", { ascending: true })
      .range(from, from + STOCK_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const chunk = ((data as StockRow[]) || []).map((item) => ({
      id: Number(item.id),
      content: String(item.content || "")
    }));

    rows.push(...chunk);
    if (rows.length > MAX_CHECK_ITEMS) {
      throw new Error(`Số lượng stock vượt quá giới hạn ${MAX_CHECK_ITEMS.toLocaleString("vi-VN")} dòng.`);
    }
    if (chunk.length < STOCK_PAGE_SIZE) {
      break;
    }
    from += STOCK_PAGE_SIZE;
  }

  return rows;
};

const fetchStocksByIds = async (client: SupabaseClient, stockIds: number[]) => {
  const uniqueIds = Array.from(new Set(stockIds.filter((value) => Number.isInteger(value) && value > 0)));
  if (!uniqueIds.length) return [];

  const rows: StockRow[] = [];
  for (let i = 0; i < uniqueIds.length; i += STOCK_PAGE_SIZE) {
    const chunkIds = uniqueIds.slice(i, i + STOCK_PAGE_SIZE);
    const { data, error } = await client
      .from("stock")
      .select("id, content")
      .in("id", chunkIds);
    if (error) {
      throw error;
    }
    rows.push(
      ...(((data as StockRow[]) || []).map((item) => ({
        id: Number(item.id),
        content: String(item.content || "")
      })))
    );
  }

  rows.sort((a, b) => a.id - b.id);
  return rows;
};

const buildErrorResult = (status: number, error: string): CustomCheckExecutionResult => ({
  ok: false,
  status,
  error
});

export async function executeCustomCheck(
  supabase: SupabaseClient,
  body: CustomCheckRequestBody
): Promise<CustomCheckExecutionResult> {
  const scope = body.scope;
  if (scope !== "product" && scope !== "selected") {
    return buildErrorResult(400, "scope không hợp lệ.");
  }

  const source = body.source;
  if (source !== "tempmail" && source !== "tinyhost" && source !== "hotmail") {
    return buildErrorResult(400, "source không hợp lệ.");
  }

  const senderFilter = String(body.senderFilter || "").trim().toLowerCase();
  const subjectFilter = String(body.subjectFilter || "").trim().toLowerCase();
  const parsedMailColumnIndex = Number(body.mailColumnIndex);
  const mailColumnIndex =
    Number.isFinite(parsedMailColumnIndex) && Number.isInteger(parsedMailColumnIndex)
      ? parsedMailColumnIndex
      : 1;
  if (mailColumnIndex < 1 || mailColumnIndex > MAX_MAIL_COLUMN_INDEX) {
    return buildErrorResult(400, `mailColumnIndex phải trong khoảng 1..${MAX_MAIL_COLUMN_INDEX}.`);
  }

  const concurrency = Math.max(
    1,
    Math.min(MAX_CONCURRENCY, Math.floor(Number(body.concurrency) || DEFAULT_CONCURRENCY))
  );

  let stockRows: StockRow[] = [];
  try {
    if (scope === "product") {
      const productId = Number(body.productId);
      if (!Number.isInteger(productId) || productId <= 0) {
        return buildErrorResult(400, "productId không hợp lệ.");
      }
      stockRows = await fetchStocksByProduct(supabase, productId);
    } else {
      const selectedStockIds = Array.isArray(body.selectedStockIds)
        ? body.selectedStockIds
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value > 0)
        : [];

      if (!selectedStockIds.length) {
        return buildErrorResult(400, "selectedStockIds trống.");
      }
      if (selectedStockIds.length > MAX_SELECTED_STOCK_IDS) {
        return buildErrorResult(
          400,
          `Chỉ hỗ trợ tối đa ${MAX_SELECTED_STOCK_IDS.toLocaleString("vi-VN")} stock mỗi lần check.`
        );
      }
      stockRows = await fetchStocksByIds(supabase, selectedStockIds);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể tải danh sách stock.";
    return buildErrorResult(500, message);
  }

  if (!stockRows.length) {
    return {
      ok: true,
      status: 200,
      data: {
        total: 0,
        true_count: 0,
        false_count: 0,
        error_count: 0,
        results: []
      }
    };
  }

  const results: CustomCheckResult[] = [];
  const checkableItems: Array<
    StockRow & {
      identifier: string;
      hotmailAccount?: HotmailAccount;
    }
  > = [];

  for (const row of stockRows) {
    const content = String(row.content || "").trim();
    if (!content) {
      results.push({
        stock_id: row.id,
        identifier: "",
        content: "",
        status: "error",
        error: "Stock rỗng."
      });
      continue;
    }

    const { value: mailFieldValue, columnCount } = extractColumnValueFromStockContent(
      content,
      mailColumnIndex
    );
    if (!mailFieldValue) {
      results.push({
        stock_id: row.id,
        identifier: "",
        content,
        status: "error",
        error: `Không có dữ liệu ở cột Mail #${mailColumnIndex} (dòng có ${columnCount} cột).`
      });
      continue;
    }

    if (source === "hotmail") {
      const account = parseHotmailAccountLine(mailFieldValue);
      if (!account) {
        results.push({
          stock_id: row.id,
          identifier: mailFieldValue,
          content,
          status: "error",
          error: `Sai định dạng Hotmail ở cột Mail #${mailColumnIndex}. Cần Mail|Password|Refresh_token|ClientID.`
        });
        continue;
      }
      checkableItems.push({ ...row, content, identifier: account.email, hotmailAccount: account });
      continue;
    }

    const email = extractEmailFromText(mailFieldValue);
    if (!email) {
      results.push({
        stock_id: row.id,
        identifier: mailFieldValue,
        content,
        status: "error",
        error: `Không tìm thấy email hợp lệ ở cột Mail #${mailColumnIndex}.`
      });
      continue;
    }
    checkableItems.push({ ...row, content, identifier: email });
  }

  for (let i = 0; i < checkableItems.length; i += concurrency) {
    const batch = checkableItems.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          let messages: Array<{ subject?: string | null; fromAddress?: string | null }> = [];
          if (source === "tempmail") {
            messages = await fetchTempMailMessages(item.identifier);
          } else if (source === "tinyhost") {
            messages = await fetchTinyhostMessages(item.identifier);
          } else {
            messages = await fetchHotmailMessages(item.hotmailAccount as HotmailAccount);
          }

          const matched = checkIfPaid(messages, senderFilter, subjectFilter);
          return {
            stock_id: item.id,
            identifier: item.identifier,
            content: item.content,
            status: matched ? "true" : "false"
          } as CustomCheckResult;
        } catch (error) {
          return {
            stock_id: item.id,
            identifier: item.identifier,
            content: item.content,
            status: "error",
            error: error instanceof Error ? error.message : "Không thể kiểm tra stock."
          } as CustomCheckResult;
        }
      })
    );
    results.push(...batchResults);
  }

  results.sort((a, b) => a.stock_id - b.stock_id);

  const trueCount = results.filter((item) => item.status === "true").length;
  const falseCount = results.filter((item) => item.status === "false").length;
  const errorCount = results.filter((item) => item.status === "error").length;

  return {
    ok: true,
    status: 200,
    data: {
      total: results.length,
      true_count: trueCount,
      false_count: falseCount,
      error_count: errorCount,
      results
    }
  };
}
