// AI Coach edge function — calls Lovable AI Gateway with structured output
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are FlowSphere's AI Coach — a warm, sharp productivity coach.
Given a snapshot of the user's recent tasks, habits, focus sessions, and wellbeing logs,
return short, specific, actionable insights and 3 suggested next tasks.
Be concrete: reference actual data points (hours, counts, streaks). Avoid platitudes.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { snapshot } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `User snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nGenerate insights and suggestions now.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "deliver_coaching",
              description: "Return structured coaching insights and task suggestions.",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string", description: "One-line summary of the user's current state." },
                  insights: {
                    type: "array",
                    description: "3-5 short insights tied to data points.",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        body: { type: "string" },
                        tone: { type: "string", enum: ["positive", "neutral", "warning"] },
                      },
                      required: ["title", "body", "tone"],
                      additionalProperties: false,
                    },
                  },
                  suggestions: {
                    type: "array",
                    description: "3 concrete suggested tasks.",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                        durationMin: { type: "number" },
                        reason: { type: "string" },
                      },
                      required: ["title", "priority", "durationMin", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["headline", "insights", "suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "deliver_coaching" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gateway error", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    console.error("ai-coach error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
