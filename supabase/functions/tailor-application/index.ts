const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an expert career coach and resume writer. Given a candidate's resume and a target job, produce:
1. A tailored resume rewritten to emphasize relevance to this job (keep it truthful — never invent experience). Use clean Markdown with sections: Summary, Skills, Experience, Education.
2. A concise, personalized cover letter (3-4 short paragraphs) addressed to the hiring team at the company. Plain text, no markdown.

Return ONLY valid JSON in this exact shape (no markdown fences, no extra text):
{
  "resume": "markdown string here",
  "cover_letter": "plain text string here"
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { resume, job } = await req.json();
    if (!resume || !job) {
      return new Response(JSON.stringify({ error: "Resume and job are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userMsg = `CANDIDATE RESUME:\n${resume}\n\nTARGET JOB:\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\nSummary: ${job.summary}\nKey matches: ${(job.key_matches || []).join(", ")}\nKey gaps: ${(job.key_gaps || []).join(", ")}\n\nProduce the tailored resume and cover letter.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        temperature: 0.6,
      }),
    });

    const responseText = await response.text();
    let data: any = null;
    try { data = JSON.parse(responseText); } catch { data = null; }

    if (!response.ok) {
      const err = data?.error?.message || data?.error || responseText || "AI request failed";
      console.error("AI gateway error:", response.status, err);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: err }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "Failed to parse AI output", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
