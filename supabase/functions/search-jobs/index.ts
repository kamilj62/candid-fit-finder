const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEARCH_PROMPT = `You are a job search assistant. Given a candidate's resume, you must:

1. Extract key skills, experience level, job titles, and preferences
2. Generate a list of 5-8 realistic job listings that would be a good match

For each job, return a JSON array with this structure:
[
  {
    "title": "Job Title",
    "company": "Company Name (make realistic but fictional)",
    "location": "City, State or Remote",
    "salary_range": "$XXk - $XXXk",
    "match_score": 85,
    "key_matches": ["skill1", "skill2"],
    "key_gaps": ["gap1"],
    "summary": "Brief 1-2 sentence job description",
    "why_good_fit": "1 sentence on why this fits",
    "honest_assessment": "Brutally honest 2-3 sentence assessment of fit. Be direct about gaps."
  }
]

RULES:
- match_score is 0-100, be HONEST - don't inflate scores
- Include some jobs with lower scores (60-75) to show realistic options
- Sort by match_score descending
- key_gaps should be real gaps, not filler
- honest_assessment must be brutally honest like the candidate speaking in first person
- Make job listings realistic for the current job market

Return ONLY the JSON array, no other text.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { resume } = await req.json();

    if (!resume) {
      return new Response(
        JSON.stringify({ error: "Resume is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SEARCH_PROMPT },
          {
            role: "user",
            content: `Here is my resume/background:\n\n${resume}\n\nFind me matching jobs.`,
          },
        ],
        temperature: 0.5,
        max_tokens: 4000,
      }),
    });

    const responseText = await response.text();
    let data: any = null;
    try { data = JSON.parse(responseText); } catch { data = null; }

    if (!response.ok) {
      const err = data?.error?.message || data?.error || data?.message || responseText || "AI request failed";
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
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON from the response (strip markdown code fences if present)
    let jobs;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      jobs = JSON.parse(cleaned);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse job results", raw: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ jobs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
