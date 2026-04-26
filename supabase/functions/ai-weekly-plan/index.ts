// AI Weekly Plan — generates a Mon→Sun plan from the last 14 days of data
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are FlowSphere's AI Coach planning a focused week.
Given the last 14 days of the user's tasks, habits, focus sessions, and wellbeing,
return a Mon→Sun plan with a clear theme and 1–3 focus tasks per day.
Respect peak hours, protect a recovery slot, and keep load realistic — never more than 3 tasks/day.
Be concrete: tie tasks to actual data points (open tasks, lagging habits, focus debt).`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { snapshot } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `User snapshot (last 14 days):\n${JSON.stringify(snapshot, null, 2)}\n\nGenerate the weekly plan now.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "deliver_weekly_plan",
              description: "Return a structured Mon→Sun plan.",
              parameters: {
                type: "object",
                properties: {
                  theme: { type: "string", description: "Short theme for the week (≤ 60 chars)." },
                  rationale: { type: "string", description: "Why this theme — reference data." },
                  days: {
                    type: "array",
                    description: "Exactly 7 days, Monday through Sunday in order.",
                    items: {
                      type: "object",
                      properties: {
                        day: {
                          type: "string",
                          enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                        },
                        intent: { type: "string", description: "One-line intent for this day." },
                        tasks: {
                          type: "array",
                          description: "1–3 focus tasks for this day.",
                          items: {
                            type: "object",
                            properties: {
                              title: { type: "string" },
                              priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                              durationMin: { type: "number" },
                              category: {
                                type: "string",
                                enum: ["work", "personal", "health", "learning", "other"],
                              },
                            },
                            required: ["title", "priority", "durationMin", "category"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["day", "intent", "tasks"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["theme", "rationale", "days"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "deliver_weekly_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");
    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-weekly-plan error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
