# AI Recommendation Engine

How FlowSphere's AI Coach actually works — concrete, not vague.

## Provider
**Lovable AI Gateway** with `google/gemini-2.5-flash` for daily nudges (cheap, fast) and `google/gemini-2.5-pro` for weekly planning (deeper reasoning). No user API key required.

Edge function: `supabase/functions/ai-coach/index.ts`.

## Three phases

### Phase 1 — Pattern-based suggestions (shipped)
Given the user's recent state, suggest 1 headline insight + 2–3 actionable tasks.

**Inputs:**
- Last 14 days of completed tasks (title, category, priority, completed_at)
- Active habits + 14-day check-in history
- Last 7 days of focus sessions (duration, time of day)
- Last 7 days of health logs (mood, water, steps, sleep)
- Current XP, level, daily score
- User's stated primary goal (from onboarding)

**Output (forced via tool-call schema):**
```json
{
  "headline": "string (≤ 80 chars)",
  "insights": ["string", "string", "string"],
  "suggested_tasks": [
    { "title": "string", "priority": "low|medium|high", "category": "...", "durationMin": 25, "rationale": "string" }
  ]
}
```

### Phase 2 — Burnout & energy detection (planned)
Adds two derived signals before sending to the model:
- `burnout_risk`: 0–1, computed from (mood trend, sleep deficit, completion drop, streak length without rest).
- `peak_hours`: array of hours with highest historical completion rate.

The system prompt then conditions on these signals:
- `burnout_risk > 0.6` → Coach must propose a Recovery Mission, never a stretch goal.
- `peak_hours` → Coach schedules suggested tasks into those windows.

### Phase 3 — Auto-generated weekly plans (planned)
Once a week (Sunday evening), Gemini Pro receives the full 4-week history and produces:
- A theme for the week ("Ship the auth system", "Reset and recover")
- 5 weekday goals
- A weekend protected-time block
- Stretch missions tied to skill-tree branches the user is leveling

User accepts, edits, or regenerates. Accepted plans become tasks with `dueDate` set.

## Prompting principles
1. **Show, don't tell.** Send raw recent data, not summaries — Gemini summarizes better than we do.
2. **Tool-call output only.** Never parse free text. Always force a JSON schema.
3. **Voice = warm coach, not corporate wellness.** Short sentences. Second person. No emoji spam.
4. **Never blame.** "Yesterday was light — let's pick one win" beats "you missed your goal".
5. **Cap suggestions at 3.** More choice = no choice.

## Privacy
- All data stays local (localStorage) until the user explicitly triggers the Coach.
- Coach calls send only the necessary slice (last 14 days, no PII beyond the user's chosen display name).
- No persistence on the edge function — it's pure pass-through to the gateway.

## Failure modes & fallbacks
| Failure | Fallback |
|---|---|
| Gateway timeout | Show last cached coach response with a "stale" badge |
| Rate limit (429) | Toast: "Coach is resting — try in a minute" |
| Schema parse error | Show raw `headline` only, hide suggestions |
| No data yet (new user) | Hardcoded onboarding nudge: "Add your first task to begin" |
