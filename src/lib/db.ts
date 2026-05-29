import { type SupabaseClient, createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Lazy-initialized server client
let _serverClient: SupabaseClient | null = null;

function getSupabaseServer(): SupabaseClient {
  if (!_serverClient) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
      );
    }
    _serverClient = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }
  return _serverClient;
}

// Browser-side client (uses anon key, respects RLS)
export const supabaseClient = typeof window !== "undefined" && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ===== User operations =====

export async function getOrCreateUser(): Promise<string> {
  // For now, single-user mode: return the first user or create one
  const { data: existing } = await getSupabaseServer()
    .from("users")
    .select("id")
    .limit(1)
    .single();

  if (existing) return existing.id;

  const { data: newUser, error } = await getSupabaseServer()
    .from("users")
    .insert({})
    .select("id")
    .single();

  if (error || !newUser) throw new Error(`Failed to create user: ${error?.message}`);
  return newUser.id;
}

export async function setGitHubToken(userId: string, token: string): Promise<void> {
  await getSupabaseServer()
    .from("users")
    .update({ github_token: token, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

export async function removeGitHubToken(userId: string): Promise<void> {
  await getSupabaseServer()
    .from("users")
    .update({ github_token: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

export async function getGitHubToken(userId: string): Promise<string | null> {
  const { data } = await getSupabaseServer()
    .from("users")
    .select("github_token")
    .eq("id", userId)
    .single();
  return data?.github_token ?? null;
}

// ===== Session operations =====

export async function getOrCreateSession(clientId: string): Promise<{ id: string; userId: string }> {
  const userId = await getOrCreateUser();

  const { data: existing } = await getSupabaseServer()
    .from("sessions")
    .select("id")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .single();

  if (existing) return { id: existing.id, userId };

  const { data: newSession, error } = await getSupabaseServer()
    .from("sessions")
    .insert({ client_id: clientId, user_id: userId })
    .select("id")
    .single();

  if (error || !newSession) throw new Error(`Failed to create session: ${error?.message}`);
  return { id: newSession.id, userId };
}

// ===== Message operations =====

export interface DbMessage {
  role: "system" | "human" | "ai" | "tool";
  content: string;
  tool_call_id?: string;
  tool_name?: string;
}

export async function getMessages(sessionId: string): Promise<DbMessage[]> {
  const { data, error } = await getSupabaseServer()
    .from("messages")
    .select("role, content, tool_call_id, tool_name")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return (data || []) as DbMessage[];
}

export async function appendMessage(sessionId: string, msg: DbMessage): Promise<void> {
  await getSupabaseServer()
    .from("messages")
    .insert({
      session_id: sessionId,
      role: msg.role,
      content: msg.content,
      tool_call_id: msg.tool_call_id ?? null,
      tool_name: msg.tool_name ?? null,
    });
}

export async function clearSessionMessages(sessionId: string): Promise<void> {
  await getSupabaseServer()
    .from("messages")
    .delete()
    .eq("session_id", sessionId);
}

// ===== Config operations =====

export interface UserConfig {
  role: string;
  toolDescription: string;
  workflow: string;
  replyStyle: string;
}

export async function getUserConfig(userId: string): Promise<UserConfig | null> {
  const { data } = await getSupabaseServer()
    .from("user_configs")
    .select("role, tool_description, workflow, reply_style")
    .eq("user_id", userId)
    .single();

  if (!data) return null;
  return {
    role: data.role,
    toolDescription: data.tool_description,
    workflow: data.workflow,
    replyStyle: data.reply_style,
  };
}

export async function setUserConfig(userId: string, config: UserConfig): Promise<void> {
  await getSupabaseServer()
    .from("user_configs")
    .upsert(
      {
        user_id: userId,
        role: config.role,
        tool_description: config.toolDescription,
        workflow: config.workflow,
        reply_style: config.replyStyle,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
}
