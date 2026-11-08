import { supabase } from "@/integrations/supabase/client";

/**
 * Calls Gemini through the `ai-proxy` Supabase Edge Function.
 * The API key stays on the server; the user's session token authorises the call.
 *
 * Drop-in replacement for `fetch(<gemini url>, init)`: pass the model and the same
 * RequestInit (with a JSON body) and you get the Gemini response back unchanged.
 */
export async function geminiFetch(model: string, init: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("AI features need a signed-in cloud account (not available in guest/offline mode).");
  }

  const payload = typeof init.body === "string" ? JSON.parse(init.body) : init.body;

  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ model, payload }),
  });
}
