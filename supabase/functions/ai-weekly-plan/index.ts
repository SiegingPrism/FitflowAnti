// AI Weekly Plan — generates a Mon→Sun plan from the last 14 days of data using Google Gemini API directly
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are FlowSphere's AI Coach planning a focused week.
Given the last 14 days of the user's tasks, habits, focus sessions, and wellbeing, and their primary focus goals,
return a Mon→Sun plan with a clear theme and 1–3 focus tasks per day.
Crucially, you must focus the plan and tasks STRICTLY on the user's selected primary goals.
Respect peak hours, protect a recovery slot, and keep load realistic — never more than 3 tasks/day.
Be concrete: tie tasks to actual data points (open tasks, lagging habits, focus debt).

IMPORTANT: You must STRICTLY restrict your weekly plan theme, rationale, and tasks to the user's selected focus modes (provided as \`primaryGoals\` in the snapshot).
Do not generate tasks or plans for unselected modes.
If the user's snapshot has NO \`primaryGoals\` selected or the array is empty, politely inform them in the rationale that they need to select their focus modes in the settings to receive tailored advice, and provide a general balanced plan based ONLY on the predefined modes below.

The focus modes are:
- "fit" (Fitness/Workout Context): Generate weekly workout splits, provide specific exercise recommendations based on available equipment, and suggest optimal rest days.
- "learn" (Study Context): Act as a tutor/focus coach. Analyze in-app activity data (e.g., peak hours) to suggest optimal study blocks. Recommend focus techniques (Pomodoro, Blurting) and specific instrumental playlists/frequencies.
- "recover" (Recovery Context): Suggest active recovery protocols, sleep hygiene tips, stretching routines, and mindfulness exercises tailored to recent task loads.
- "ship" (Career/Deep Work): Focus on time-blocking, email management strategies, networking tips, and preventing burnout.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { snapshot, apiKey } = await req.json();
    const GEMINI_API_KEY = apiKey || Deno.env.get("VITE_GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const userPrompt = `User snapshot (last 14 days):\n${JSON.stringify(snapshot, null, 2)}\n\nGenerate the weekly plan now.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              theme: { type: "STRING", description: "Short theme for the week (≤ 60 chars)." },
              rationale: { type: "STRING", description: "Why this theme — reference data." },
              days: {
                type: "ARRAY",
                description: "Exactly 7 days, Monday through Sunday in order.",
                items: {
                  type: "OBJECT",
                  properties: {
                    day: {
                      type: "STRING",
                      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                    },
                    intent: { type: "STRING", description: "One-line intent for this day." },
                    tasks: {
                      type: "ARRAY",
                      description: "1–3 focus tasks for this day.",
                      items: {
                        type: "OBJECT",
                        properties: {
                          title: { type: "STRING" },
                          priority: { type: "STRING", enum: ["low", "medium", "high", "urgent"] },
                          durationMin: { type: "NUMBER" },
                          category: {
                            type: "STRING",
                            enum: ["work", "personal", "health", "learning", "other"],
                          },
                        },
                        required: ["title", "priority", "durationMin", "category"]
                      },
                    },
                  },
                  required: ["day", "intent", "tasks"]
                },
              },
            },
            required: ["theme", "rationale", "days"],
          }
        }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gemini API error", response.status, t);
      return new Response(JSON.stringify({ error: "AI API error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error("No text in response");

    const resultJson = JSON.parse(resultText);

    return new Response(JSON.stringify(resultJson), {
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
