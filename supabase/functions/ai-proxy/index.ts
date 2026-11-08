// ai-proxy — forwards Gemini generateContent calls from the app.
// The Gemini key lives only here (Supabase secret GEMINI_API_KEY), never in the client bundle.
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=<new key>
//   supabase functions deploy ai-proxy
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_MODELS = new Set(["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"]);
const DEFAULT_MODEL = Deno.env.get("GEMINI_DEFAULT_MODEL") ?? "gemini-3.5-flash";
const MAX_BODY_BYTES = 200_000;

// Simple per-user limiter (per function instance): 20 requests / 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;
const hits = new Map<string, number[]>();

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json(500, { error: "GEMINI_API_KEY secret is not set" });

  // Verify the caller is a signed-in user
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "Not signed in" });
  const userId = userData.user.id;

  // Rate limit
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return json(429, { error: "Too many AI requests. Try again in a few minutes." });
  recent.push(now);
  hits.set(userId, recent);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Request too large" });

  let parsed: { model?: string; payload?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!parsed.payload || typeof parsed.payload !== "object") return json(400, { error: "Missing payload" });

  const model = parsed.model && ALLOWED_MODELS.has(parsed.model) ? parsed.model : DEFAULT_MODEL;

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(parsed.payload),
    },
  );

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
