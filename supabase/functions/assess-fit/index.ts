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

    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `Here is the job description:\n\n${jobDescription}\n\nHere is my resume/background:\n\n${resume}\n\nPlease provide your honest assessment.`,
        }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    const responseText = await response.text();
    let data: any = null;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = null;
    }

    if (!response.ok) {
      const gatewayError =
        (typeof data?.error === "string" && data.error) ||
        data?.error?.message ||
        data?.message ||
        responseText ||
        "AI request failed";

      console.error("AI gateway request failed:", response.status, gatewayError);

      return new Response(
        JSON.stringify({ error: gatewayError }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const textBlocks = Array.isArray(data?.content)
      ? data.content.filter((block: any) => block?.type === "text")
      : [];
    const assessment = textBlocks.map((block: any) => block.text).join("\n").trim();

    if (!assessment) {
      return new Response(
        JSON.stringify({ error: "AI response did not contain an assessment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
