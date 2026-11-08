// "Ask GO!" — turns a plain-English request into structured search filters.
// Gemini only parses the request; Tiger runs the actual search.

export interface SearchFilters {
  courtType?: "beach" | "grass" | "indoor";
  day?: string;            // YYYY-MM-DD, local time
  timeOfDay?: "morning" | "afternoon" | "evening";
  maxPrice?: number;
  skillLevel?: string;
  maxDistanceKm?: number;
  openSpotsOnly?: boolean;
}

export interface ParsedQuery {
  filters: SearchFilters;
  reply: string;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const TZ = "America/New_York";

const responseSchema = {
  type: "OBJECT",
  properties: {
    courtType:     { type: "STRING", enum: ["beach", "grass", "indoor", "any"] },
    day:           { type: "STRING", description: "YYYY-MM-DD, or empty string if no day mentioned" },
    timeOfDay:     { type: "STRING", enum: ["morning", "afternoon", "evening", "any"] },
    maxPrice:      { type: "NUMBER", description: "-1 if not mentioned; 0 means free only" },
    skillLevel:    { type: "STRING", enum: ["Beginner", "Intermediate", "Advanced", "any"] },
    maxDistanceKm: { type: "NUMBER", description: "-1 if not mentioned" },
    openSpotsOnly: { type: "BOOLEAN" },
    reply:         { type: "STRING", description: "One short, friendly sentence describing what you searched for" },
  },
  required: ["courtType", "day", "timeOfDay", "maxPrice", "skillLevel", "maxDistanceKm", "openSpotsOnly", "reply"],
};

export async function parseSearch(query: string, apiKey: string): Promise<ParsedQuery> {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  const weekday = now.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ });
  const clock = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });

  const prompt = `You convert requests for pickup volleyball games into search filters for the GO! app.
Today is ${weekday}, ${today}, and it is ${clock} local time.

Rules:
- courtType: "beach" also covers sand; "grass" covers park/outdoor grass; "indoor" covers gym. Otherwise "any".
- day: resolve words like "today", "tonight", "tomorrow", "Saturday", "this weekend" (use the next Saturday) to YYYY-MM-DD. Empty string if no day.
- timeOfDay: morning (before noon), afternoon (noon-5pm), evening (after 5pm, "tonight", "after work"). Otherwise "any".
- maxPrice: "free" means 0. "under $5" means 5. -1 if not mentioned.
- skillLevel: map "newbie", "casual", "chill" to Beginner; "competitive", "good players" to Advanced. Otherwise "any".
- maxDistanceKm: convert miles to km (1 mile = 1.6 km). "near me" or "close" means 8. -1 if not mentioned.
- openSpotsOnly: true if they want games they can still join ("open", "need players", "spots left"), else false.
- reply: one short friendly sentence, like "Here are free beach games tonight near you."

Request: ${JSON.stringify(query)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data: any = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  const raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));

  const filters: SearchFilters = {};
  if (["beach", "grass", "indoor"].includes(raw.courtType)) filters.courtType = raw.courtType;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.day ?? "")) filters.day = raw.day;
  if (["morning", "afternoon", "evening"].includes(raw.timeOfDay)) filters.timeOfDay = raw.timeOfDay;
  if (typeof raw.maxPrice === "number" && raw.maxPrice >= 0) filters.maxPrice = raw.maxPrice;
  if (["Beginner", "Intermediate", "Advanced"].includes(raw.skillLevel)) filters.skillLevel = raw.skillLevel;
  if (typeof raw.maxDistanceKm === "number" && raw.maxDistanceKm > 0) filters.maxDistanceKm = raw.maxDistanceKm;
  if (raw.openSpotsOnly === true) filters.openSpotsOnly = true;

  return { filters, reply: String(raw.reply || "Here's what I found.") };
}
