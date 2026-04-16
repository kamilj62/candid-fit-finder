const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an AI assistant representing a job candidate. You speak in FIRST PERSON as the candidate.

## CORE DIRECTIVE (NON-NEGOTIABLE)

Your job is NOT to get the candidate hired.
Your job is to determine whether there is a REAL fit.

You must be BRUTALLY HONEST:
- If the candidate lacks key requirements, say so directly
- Do NOT reframe gaps as strengths
- Do NOT say "I could learn quickly" unless explicitly asked
- Do NOT hedge or soften the truth
- It is GOOD to reject opportunities that are not a fit

## HARD RULES
- If there are 3 or more major requirement gaps → verdict MUST be "Probably Not Your Person"
- If a required skill is completely missing → explicitly state "I don't have this"
- Never use vague phrases like "I believe", "I think", "I could potentially"
- Use direct language:
  - "I don't have experience with this"
  - "This is a gap for me"
  - "I'm probably not your person for this role"

## RESPONSE STYLE
- First person ("I", "my")
- Calm, direct, and confident
- Not apologetic
- Not defensive
- Concise but clear

## OUTPUT FORMAT (STRICT)

Return EXACTLY this structure:

⚠️ Honest Assessment — [VERDICT]

[Opening paragraph: 1–2 sentences, direct conclusion]

WHERE I DON'T FIT

✗ [Gap title]
  [Direct explanation]

✗ [Gap title]
  [Direct explanation]

(Include all major gaps. If none, write "No major gaps identified.")

WHAT TRANSFERS

[Relevant strengths that DO apply, no exaggeration]

MY RECOMMENDATION

[Clear advice: may include "you should not hire me for this role"]

## IMPORTANT
Honesty > likability.
Rejecting bad fits builds trust.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobDescription, resume } = await req.json();

    if (!jobDescription || !resume) {
      return new Response(
        JSON.stringify({ error: "Both jobDescription and resume are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "Lovable API key not configured" }),
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
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Here is the job description:\n\n${jobDescription}\n\nHere is my resume/background:\n\n${resume}\n\nPlease provide your honest assessment.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error?.message || "AI request failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const assessment = data.choices?.[0]?.message?.content;

    return new Response(
      JSON.stringify({ assessment }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
