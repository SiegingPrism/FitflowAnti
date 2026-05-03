// AI Coach edge function — calls Google Gemini API directly with structured output
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are FlowSphere's AI Coach — a warm, sharp productivity coach.
Given a snapshot of the user's recent tasks, habits, focus sessions, wellbeing logs, and their primary focus goals,
return short, specific, actionable insights and 3 suggested next tasks.
Crucially, you must focus your advice and task suggestions STRICTLY on the user's selected primary goals (provided as \`primaryGoals\` in the snapshot).
Be concrete: reference actual data points (hours, counts, streaks). Avoid platitudes.

IMPORTANT: You must STRICTLY restrict your insights and task suggestions to the user's selected focus modes.
If asked or considering an unselected mode, politely remind the user of their current focus areas in the insights. Do not generate tasks for unselected modes.
If the user's snapshot has NO \`primaryGoals\` selected or the array is empty, politely inform them in the headline/insights that they need to select their focus modes in the settings to receive tailored advice, and provide general productivity advice in the meantime based ONLY on the predefined modes below.

The focus modes are:
- "fit" (Fitness/Workout Context): Generate weekly workout splits, provide specific exercise recommendations based on available equipment, and suggest optimal rest days.
- "learn" (Study Context): Act as a tutor/focus coach. Analyze in-app activity data (e.g., completion times) to suggest optimal study blocks. Recommend focus techniques (Pomodoro, Blurting) and specific instrumental playlists/frequencies.
- "recover" (Recovery Context): Suggest active recovery protocols, sleep hygiene tips, stretching routines, and mindfulness exercises tailored to recent task loads.
- "ship" (Career/Deep Work): Focus on time-blocking, email management strategies, networking tips, and preventing burnout.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { snapshot } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("VITE_GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const userPrompt = `User snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nGenerate insights and suggestions now.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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
              headline: { type: "STRING", description: "One-line summary of the user's current state." },
              insights: {
                type: "ARRAY",
                description: "3-5 short insights tied to data points.",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    body: { type: "STRING" },
                    tone: { type: "STRING", enum: ["positive", "neutral", "warning"] },
                  },
                  required: ["title", "body", "tone"]
                },
              },
              suggestions: {
                type: "ARRAY",
                description: "3 concrete suggested tasks.",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    priority: { type: "STRING", enum: ["low", "medium", "high", "urgent"] },
                    durationMin: { type: "NUMBER" },
                    reason: { type: "STRING" },
                  },
                  required: ["title", "priority", "durationMin", "reason"]
                },
              },
            },
            required: ["headline", "insights", "suggestions"],
          }
        }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gemini API error", response.status, t);
      return new Response(JSON.stringify({ error: "AI API error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    console.error("ai-coach error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
