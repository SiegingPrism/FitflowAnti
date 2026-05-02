import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const getGeminiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GEMINI_API_KEY is not set in your .env file.");
  }
  return new GoogleGenerativeAI(apiKey);
};

export const generateCoachInsights = async (snapshot: any) => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: "You are FlowSphere's AI Coach — a warm, sharp productivity coach.\nGiven a snapshot of the user's recent tasks, habits, focus sessions, and wellbeing logs,\nreturn short, specific, actionable insights and 3 suggested next tasks.\nBe concrete: reference actual data points (hours, counts, streaks). Avoid platitudes.",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          headline: { type: SchemaType.STRING, description: "One-line summary of the user's current state." },
          insights: {
            type: SchemaType.ARRAY,
            description: "3-5 short insights tied to data points.",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING },
                body: { type: SchemaType.STRING },
                tone: { type: SchemaType.STRING, enum: ["positive", "neutral", "warning"], format: "enum" },
              },
              required: ["title", "body", "tone"],
            },
          },
          suggestions: {
            type: SchemaType.ARRAY,
            description: "3 concrete suggested tasks.",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING },
                priority: { type: SchemaType.STRING, enum: ["low", "medium", "high", "urgent"], format: "enum" },
                durationMin: { type: SchemaType.NUMBER },
                reason: { type: SchemaType.STRING },
              },
              required: ["title", "priority", "durationMin", "reason"],
            },
          },
        },
        required: ["headline", "insights", "suggestions"],
      },
    },
  });

  const prompt = `User snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nGenerate insights and suggestions now.`;
  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
};

export const generateWeeklyPlan = async (snapshot: any) => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: "You are an AI Weekly Planner. Generate a 7-day plan (Mon-Sun) based on the user's snapshot. Focus on their primary goal and current open tasks. Suggest new tasks if needed to fill gaps. Be realistic about time.",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          theme: { type: SchemaType.STRING, description: "Theme for the week" },
          rationale: { type: SchemaType.STRING, description: "Why this plan fits the user's current state" },
          days: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                day: { type: SchemaType.STRING, enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], format: "enum" },
                intent: { type: SchemaType.STRING, description: "Daily intention or focus" },
                tasks: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      title: { type: SchemaType.STRING },
                      priority: { type: SchemaType.STRING, enum: ["low", "medium", "high", "urgent"], format: "enum" },
                      durationMin: { type: SchemaType.NUMBER },
                      category: { type: SchemaType.STRING, enum: ["work", "personal", "health", "learning", "other"], format: "enum" },
                    },
                    required: ["title", "priority", "durationMin", "category"],
                  },
                },
              },
              required: ["day", "intent", "tasks"],
            },
          },
        },
        required: ["theme", "rationale", "days"],
      },
    },
  });

  const prompt = `User snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nGenerate weekly plan now.`;
  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
};
