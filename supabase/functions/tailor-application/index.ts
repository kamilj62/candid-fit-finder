import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Job = {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  url?: string;
  fitScore?: number;
  reasons?: string[];
  gaps?: string[];
};

type TailorRequest = {
  resume?: string;
  job?: Job;
};

type TailorResponse = {
  resume: string;
  cover_letter: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resume, job }: TailorRequest = await req.json();

    if (!resume || !resume.trim()) {
      return jsonResponse({ error: "Missing resume" }, 400);
    }

    if (!job || !job.title) {
      return jsonResponse({ error: "Missing job data" }, 400);
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const company = job.company || "the employer";
    const location = job.location || "";
    const description = job.description || "";
    const reasons = job.reasons || [];
    const gaps = job.gaps || [];

    const greeting =
      !company || company.toLowerCase() === "unknown company"
        ? "Dear Hiring Team,"
        : `Dear ${company} Hiring Team,`;

    const prompt = `
Return ONLY valid JSON:

{
  "resume": "...",
  "cover_letter": "..."
}

Candidate resume:
${resume.slice(0, 12000)}

Job:
Title: ${job.title}
Company: ${company}
Location: ${location}

Strengths:
${reasons.map((r) => `- ${r}`).join("\n")}

Gaps:
${gaps.map((g) => `- ${g}`).join("\n")}

Job description:
${description.slice(0, 8000)}
`;

    // 🔹 1. Try Anthropic
    if (ANTHROPIC_API_KEY) {
      const result = await callAnthropic(ANTHROPIC_API_KEY, prompt);
      if (result) return jsonResponse(result);
    }

    // 🔹 2. Try OpenAI
    if (OPENAI_API_KEY) {
      const result = await callOpenAI(OPENAI_API_KEY, prompt);
      if (result) return jsonResponse(result);
    }

    // 🔹 3. Final fallback
    return jsonResponse(
      buildFallbackTailoring(resume, job, greeting, reasons, gaps)
    );
  } catch (err) {
    console.error("tailor-application error:", err);
    return jsonResponse({ error: "Server error" }, 500);
  }
});


// =======================
// Anthropic
// =======================

async function callAnthropic(
  key: string,
  prompt: string
): Promise<TailorResponse | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 1800,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic failed:", await res.text());
      return null;
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text ?? "";

    return safeParse(text);
  } catch (err) {
    console.error("Anthropic error:", err);
    return null;
  }
}


// =======================
// OpenAI fallback
// =======================

async function callOpenAI(
  key: string,
  prompt: string
): Promise<TailorResponse | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
      }),
    });

    if (!res.ok) {
      console.error("OpenAI failed:", await res.text());
      return null;
    }

    const data = await res.json();
    const text = data?.output_text || "";

    return safeParse(text);
  } catch (err) {
    console.error("OpenAI error:", err);
    return null;
  }
}


// =======================
// Safe JSON parse
// =======================

function safeParse(text: string): TailorResponse | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed.resume && parsed.cover_letter) return parsed;
  } catch {
    console.error("Bad JSON:", text);
  }
  return null;
}


// =======================
// Fallback (no AI)
// =======================

function buildFallbackTailoring(
  resume: string,
  job: Job,
  greeting: string,
  reasons: string[],
  gaps: string[]
): TailorResponse {
  const name = extractNameFromResume(resume);

  const fallbackResume = `${resume}

---

Tailored for ${job.title}
Focus on: ${reasons.join(", ") || "relevant experience"}
`;

  const fallbackCoverLetter = `${greeting}

I am excited to apply for the ${job.title}${job.company ? ` at ${job.company}` : ""}.

My experience aligns well with this role, especially in ${reasons.join(", ") || "software engineering"}.

I am confident I can ramp quickly and contribute effectively.

Thank you for your consideration.

Sincerely,
${name}`;

  return {
    resume: fallbackResume,
    cover_letter: fallbackCoverLetter,
  };
}


// =======================
// Name extraction
// =======================

function extractNameFromResume(resume: string): string {
  const firstLine = resume.split("\n").map((l) => l.trim()).find(Boolean) || "";

  if (
    firstLine &&
    firstLine.length < 60 &&
    !firstLine.includes("@") &&
    !firstLine.toLowerCase().includes("engineer")
  ) {
    return firstLine;
  }

  return "Your Name";
}


// =======================
// Response helper
// =======================

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}