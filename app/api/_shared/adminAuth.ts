import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const buildSupabaseClient = (token?: string) =>
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      : undefined
  });

type AdminSessionSuccess = {
  ok: true;
  supabase: SupabaseClient;
  user: User;
  token: string;
};

type AdminSessionFailure = {
  ok: false;
  response: NextResponse;
};

export type AdminSessionResult = AdminSessionSuccess | AdminSessionFailure;

export async function requireAdminSession(request: NextRequest): Promise<AdminSessionResult> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Supabase env missing." }, { status: 500 })
    };
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    };
  }

  const authClient = buildSupabaseClient();
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    };
  }

  const supabase = buildSupabaseClient(token);
  const { data: adminRow, error: adminError } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError || !adminRow) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 })
    };
  }

  return {
    ok: true,
    supabase,
    user: userData.user,
    token
  };
}
