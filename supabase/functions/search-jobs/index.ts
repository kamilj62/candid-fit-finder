import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SearchRequest = {
  resumeText?: string;
  location?: string;
  remoteOnly?: boolean;
  targetTitles?: string[];
  targetJobTitles?: string;
};

type AdzunaJob = {
  id?: string;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  salary_min?: number;
  salary_max?: number;
  category?: { label?: string; tag?: string };
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
};

type ScoredJob = AdzunaJob & {
  score: number;
  source: string;
  postedDate: string | null;
  fitScore: number;
  reasons: string[];
  gaps: string[];
  recommendation: "apply" | "maybe" | "skip";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SearchRequest = await req.json();

    const resumeText = (body.resumeText || "").trim();
    const location = (body.location || "United States").trim();
    const remoteOnly = Boolean(body.remoteOnly);

    const explicitTitles = parseTargetTitles(body.targetTitles, body.targetJobTitles);

    const ADZUNA_APP_ID = Deno.env.get("ADZUNA_APP_ID");
    const ADZUNA_APP_KEY = Deno.env.get("ADZUNA_APP_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
      return jsonResponse(
        {
          error: "Missing Adzuna credentials. Set ADZUNA_APP_ID and ADZUNA_APP_KEY in Supabase secrets.",
        },
        500
      );
    }

    const seniority = inferSeniority(resumeText);
    const resumeSkills = extractResumeSkills(resumeText);

    const inferredTitles =
      explicitTitles.length > 0
        ? explicitTitles
        : await inferTitlesFromResume(resumeText, ANTHROPIC_API_KEY);

    const expandedTitles = expandTitles(inferredTitles, resumeText, seniority).slice(0, 3);
    const searchLocations = buildSearchLocations(location, remoteOnly).slice(0, 2);

    const allJobs: AdzunaJob[] = [];

    for (const title of expandedTitles) {
      for (const searchLocation of searchLocations) {
        const titleQuery = applySeniorityToQuery(title, seniority);

        const adzunaJobs = await fetchJobsForQuery({
          appId: ADZUNA_APP_ID,
          appKey: ADZUNA_APP_KEY,
          titleQuery,
          locationQuery: searchLocation,
          remoteOnly,
          resultsPerPage: 10,
          page: 1,
        });

        allJobs.push(...adzunaJobs);
      }
    }

    const dedupedJobs = dedupeJobs(allJobs);

    const scoringContext = {
      resumeSkills,
      targetTitles: expandedTitles,
      seniority,
      preferredLocation: location,
      remoteOnly,
    };

    const scoredJobs: ScoredJob[] = dedupedJobs
      .map((job) => {
        const score = scoreJob(job, scoringContext);
        const appraisal = quickFit(job, scoringContext);

        return {
          ...job,
          score,
          fitScore: appraisal.fitScore,
          reasons: appraisal.reasons,
          gaps: appraisal.gaps,
          recommendation: appraisal.recommendation,
          source: "Adzuna",
          postedDate: job.created ?? null,
        };
      })
      .sort((a, b) => {
        const recommendationOrder = { apply: 0, maybe: 1, skip: 2 };
        if (recommendationOrder[a.recommendation] !== recommendationOrder[b.recommendation]) {
          return recommendationOrder[a.recommendation] - recommendationOrder[b.recommendation];
        }
        if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
        return b.score - a.score;
      })
      .slice(0, 20);

    return jsonResponse({
      jobs: scoredJobs.map((job) => ({
        title: job.title || "Untitled Role",
        company: job.company?.display_name || "Unknown Company",
        location: job.location?.display_name || "Unknown Location",
        description: job.description || "",
        url: job.redirect_url || "",
        salaryMin: job.salary_min ?? null,
        salaryMax: job.salary_max ?? null,
        source: job.source,
        postedDate: job.postedDate,
        score: job.score,
        fitScore: job.fitScore,
        reasons: job.reasons,
        gaps: job.gaps,
        recommendation: job.recommendation,
        category: job.category?.label || null,
      })),
      meta: {
        inferredTitles,
        expandedTitles,
        seniority,
        resumeSkills,
        totalFetched: allJobs.length,
        totalDeduped: dedupedJobs.length,
      },
    });
  } catch (error) {
    console.error("search-jobs error:", error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      500
    );
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function parseTargetTitles(targetTitles?: string[], targetJobTitles?: string): string[] {
  const fromArray = Array.isArray(targetTitles) ? targetTitles : [];
  const fromString =
    typeof targetJobTitles === "string"
      ? targetJobTitles.split(",").map((s) => s.trim())
      : [];

  return [...fromArray, ...fromString].filter(Boolean);
}

function inferSeniority(resumeText: string): "entry" | "mid" | "senior" {
  const text = resumeText.toLowerCase();

  // If transitioning careers, treat as entry level for the new field
  if (
    /transitioning|career change|career transition|new to (ai|ml|software|engineering)/.test(text)
  ) {
    return "entry";
  }

  const years = extractYearsOfExperience(text);

  if (
    /intern|internship|new grad|entry level|junior|jr\b/.test(text) ||
    (years !== null && years <= 2)
  ) {
    return "entry";
  }

  if (
    /staff|principal|lead|architect|director|vp|head of/.test(text) ||
    (years !== null && years >= 7)
  ) {
    return "senior";
  }

  return "mid";
}

function extractYearsOfExperience(text: string): number | null {
  const patterns = [
    /(\d+)\+?\s+years? of experience/,
    /(\d+)\+?\s+years? experience/,
    /over\s+(\d+)\s+years?/,
    /(\d+)\s+years?\s+in/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }

  return null;
}

function extractResumeSkills(resumeText: string): string[] {
  const knownSkills = [
    "python",
    "javascript",
    "typescript",
    "java",
    "c++",
    "c#",
    "go",
    "ruby",
    "php",
    "react",
    "react native",
    "node",
    "node.js",
    "next.js",
    "vue",
    "angular",
    "html",
    "css",
    "tailwind",
    "sql",
    "postgres",
    "mysql",
    "mongodb",
    "firebase",
    "supabase",
    "aws",
    "gcp",
    "azure",
    "docker",
    "kubernetes",
    "terraform",
    "fastapi",
    "django",
    "flask",
    "express",
    "rest api",
    "graphql",
    "git",
    "linux",
    "machine learning",
    "deep learning",
    "llm",
    "openai",
    "anthropic",
    "rag",
    "langchain",
    "tensorflow",
    "pytorch",
    "scikit-learn",
    "pandas",
    "numpy",
    "xgboost",
    "opencv",
    "mediapipe",
    "vercel",
  ];

  const lower = resumeText.toLowerCase();
  return knownSkills.filter((skill) => lower.includes(skill.toLowerCase()));
}

async function inferTitlesFromResume(
  resumeText: string,
  anthropicApiKey?: string | null
): Promise<string[]> {
  if (!resumeText.trim()) {
    return ["Software Engineer", "Full Stack Engineer", "Backend Engineer"];
  }

  if (!anthropicApiKey) {
    return fallbackTitlesFromResumeText(resumeText);
  }

  try {
    const prompt = `
You are extracting likely job targets from a resume.

Return ONLY valid JSON in this exact shape:
{"titles":["Title 1","Title 2","Title 3","Title 4","Title 5"]}

RULES:
- match_score is 0-100, be BRUTALLY HONEST - don't inflate scores
- If the candidate is entry-level or transitioning careers, senior roles should score 40-55 MAX
- Include some jobs with lower scores (50-65) to show realistic options
- Sort by match_score descending
- key_gaps should be real gaps, not filler
- honest_assessment must be brutally honest, candidate speaking in first person
- If the role requires 5+ years experience and candidate has less than 2, score it below 60
- Make job listings realistic for the current job market

Resume:
${resumeText.slice(0, 12000)}
`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 300,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.warn("Anthropic title inference failed:", await response.text());
      return fallbackTitlesFromResumeText(resumeText);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text ?? "";
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed?.titles)) {
      return fallbackTitlesFromResumeText(resumeText);
    }

    return parsed.titles.map((t: string) => t.trim()).filter(Boolean).slice(0, 6);
  } catch (error) {
    console.warn("Anthropic inference error:", error);
    return fallbackTitlesFromResumeText(resumeText);
  }
}

function fallbackTitlesFromResumeText(resumeText: string): string[] {
  const text = resumeText.toLowerCase();
  const titles = new Set<string>();

  if (text.includes("react")) {
    titles.add("Frontend Engineer");
    titles.add("Full Stack Engineer");
  }

  if (text.includes("node") || text.includes("backend") || text.includes("api")) {
    titles.add("Backend Engineer");
    titles.add("Software Engineer");
  }

  if (text.includes("python")) {
    titles.add("Python Developer");
    titles.add("Software Engineer");
  }

  if (
    text.includes("machine learning") ||
    text.includes("ai") ||
    text.includes("llm") ||
    text.includes("rag")
  ) {
    titles.add("AI Engineer");
    titles.add("Machine Learning Engineer");
    titles.add("Applied AI Engineer");
  }

  if (titles.size === 0) {
    titles.add("Software Engineer");
    titles.add("Full Stack Engineer");
    titles.add("Backend Engineer");
  }

  return Array.from(titles).slice(0, 6);
}

function expandTitles(
  baseTitles: string[],
  resumeText: string,
  seniority: "entry" | "mid" | "senior"
): string[] {
  const variations = new Set<string>();

  for (const raw of baseTitles) {
    const title = raw.trim();
    const lower = title.toLowerCase();

    if (!title) continue;

    variations.add(title);

    if (lower.includes("software")) {
      variations.add("Software Engineer");
      variations.add("Full Stack Engineer");
      variations.add("Backend Engineer");
      variations.add("Frontend Engineer");
    }

    if (lower.includes("full stack")) {
      variations.add("Software Engineer");
      variations.add("Backend Engineer");
      variations.add("Frontend Engineer");
      variations.add("Full Stack Developer");
    }

    if (lower.includes("frontend") || lower.includes("react")) {
      variations.add("Frontend Engineer");
      variations.add("React Developer");
      variations.add("UI Engineer");
    }

    if (lower.includes("backend") || lower.includes("api")) {
      variations.add("Backend Engineer");
      variations.add("Software Engineer");
      variations.add("Platform Engineer");
    }

    if (lower.includes("ai") || lower.includes("machine learning") || lower.includes("ml")) {
      variations.add("AI Engineer");
      variations.add("Machine Learning Engineer");
      variations.add("Applied AI Engineer");
      variations.add("Python Developer");
    }

    if (lower.includes("developer")) {
      variations.add(title.replace(/developer/i, "Engineer"));
      variations.add("Software Developer");
    }
  }

  const text = resumeText.toLowerCase();

  if (text.includes("python")) variations.add("Python Developer");
  if (text.includes("react")) variations.add("Frontend Engineer");
  if (text.includes("node")) variations.add("Backend Engineer");
  if (text.includes("fastapi")) variations.add("Backend Engineer");
  if (text.includes("rag") || text.includes("llm")) variations.add("Applied AI Engineer");

  const cleaned = Array.from(variations)
    .map((t) => normalizeTitleForSeniority(t, seniority))
    .filter(Boolean);

  return Array.from(new Set(cleaned)).slice(0, 8);
}

function normalizeTitleForSeniority(
  title: string,
  seniority: "entry" | "mid" | "senior"
): string {
  let normalized = title
    .replace(/\bSenior\b/gi, "")
    .replace(/\bStaff\b/gi, "")
    .replace(/\bLead\b/gi, "")
    .replace(/\bPrincipal\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) normalized = title.trim();

  return normalized;
}

function applySeniorityToQuery(
  title: string,
  seniority: "entry" | "mid" | "senior"
): string {
  if (seniority === "entry") {
    return `${title} junior OR "entry level" OR associate`;
  }

  if (seniority === "senior") {
    return `${title} senior OR lead OR staff`;
  }

  return title;
}

function buildSearchLocations(location: string, remoteOnly: boolean): string[] {
  if (remoteOnly) return ["remote"];

  const variants = new Set<string>();
  variants.add(location);

  const lower = location.toLowerCase();

  if (lower.includes("los angeles")) {
    variants.add("Los Angeles");
    variants.add("Remote");
    variants.add("California");
  } else if (lower.includes("new york")) {
    variants.add("New York");
    variants.add("Remote");
  } else {
    variants.add("Remote");
  }

  return Array.from(variants).slice(0, 3);
}

async function fetchJobsForQuery(params: {
  appId: string;
  appKey: string;
  titleQuery: string;
  locationQuery: string;
  remoteOnly: boolean;
  resultsPerPage?: number;
  page?: number;
}): Promise<AdzunaJob[]> {
  const {
    appId,
    appKey,
    titleQuery,
    locationQuery,
    resultsPerPage = 10,
    page = 1,
  } = params;

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/us/search/${page}`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("what", titleQuery);
  url.searchParams.set("where", locationQuery);
  url.searchParams.set("results_per_page", String(resultsPerPage));
  url.searchParams.set("content-type", "application/json");

  const response = await fetch(url.toString());

  if (!response.ok) {
    console.warn("Adzuna search failed:", response.status, await response.text());
    return [];
  }

  const data = await response.json();
  return Array.isArray(data?.results) ? data.results : [];
}

function dedupeJobs(jobs: AdzunaJob[]): AdzunaJob[] {
  const seen = new Set<string>();
  const result: AdzunaJob[] = [];

  for (const job of jobs) {
    const key = [
      normalizeForDedupe(job.title || ""),
      normalizeForDedupe(job.company?.display_name || ""),
      normalizeForDedupe(job.location?.display_name || ""),
    ].join(" | ");

    if (!seen.has(key)) {
      seen.add(key);
      result.push(job);
    }
  }

  return result;
}

function normalizeForDedupe(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

function scoreJob(
  job: AdzunaJob,
  context: {
    resumeSkills: string[];
    targetTitles: string[];
    seniority: "entry" | "mid" | "senior";
    preferredLocation: string;
    remoteOnly: boolean;
  }
): number {
  const title = (job.title || "").toLowerCase();
  const description = (job.description || "").toLowerCase();
  const company = (job.company?.display_name || "").toLowerCase();
  const location = (job.location?.display_name || "").toLowerCase();

  let titleScore = 0;
  let seniorityScore = 0;
  let skillsScore = 0;
  let locationScore = 0;
  let qualityScore = 0;

  for (const targetTitle of context.targetTitles) {
    const target = targetTitle.toLowerCase();

    if (title === target) {
      titleScore = Math.max(titleScore, 30);
    } else if (title.includes(target)) {
      titleScore = Math.max(titleScore, 24);
    } else {
      const overlap = tokenOverlap(title, target);
      if (overlap >= 0.75) titleScore = Math.max(titleScore, 18);
      else if (overlap >= 0.5) titleScore = Math.max(titleScore, 12);
      else if (isAdjacentTitle(title, target)) titleScore = Math.max(titleScore, 8);
    }
  }

  const seniorityText = `${title} ${description}`;

  if (context.seniority === "entry") {
    if (/\b(junior|jr\b|entry level|associate|new grad|graduate)\b/.test(seniorityText)) {
      seniorityScore += 20;
    }
    if (/\b(mid level|2\+ years|3\+ years)\b/.test(seniorityText)) {
      seniorityScore += 6;
    }
    if (/\b(senior|staff|lead|principal|director|manager|architect)\b/.test(seniorityText)) {
      seniorityScore -= 25;
    }
    if (/\b(5\+ years|7\+ years|8\+ years|10\+ years)\b/.test(seniorityText)) {
      seniorityScore -= 20;
    }
  }

  if (context.seniority === "mid") {
    if (/\b(mid level|3\+ years|4\+ years|5\+ years)\b/.test(seniorityText)) {
      seniorityScore += 16;
    }
    if (/\b(junior|jr\b|entry level|intern|new grad)\b/.test(seniorityText)) {
      seniorityScore -= 12;
    }
    if (/\b(staff|principal|director)\b/.test(seniorityText)) {
      seniorityScore -= 10;
    }
  }

  if (context.seniority === "senior") {
    if (/\b(senior|staff|lead|principal|architect)\b/.test(seniorityText)) {
      seniorityScore += 20;
    }
    if (/\b(7\+ years|8\+ years|10\+ years)\b/.test(seniorityText)) {
      seniorityScore += 10;
    }
    if (/\b(junior|jr\b|entry level|intern|new grad)\b/.test(seniorityText)) {
      seniorityScore -= 25;
    }
  }

  const coreSkills = [
    "python",
    "javascript",
    "typescript",
    "react",
    "node",
    "sql",
    "aws",
    "docker",
    "machine learning",
    "ai",
    "llm",
    "rag",
    "fastapi",
    "tensorflow",
    "pytorch",
    "scikit-learn",
  ];

  const secondarySkills = [
    "tailwind",
    "mongodb",
    "postgres",
    "firebase",
    "supabase",
    "vercel",
    "git",
    "linux",
    "opencv",
    "mediapipe",
    "xgboost",
    "pandas",
    "numpy",
  ];

  let matchedCore = 0;
  let matchedSecondary = 0;

  for (const skill of context.resumeSkills) {
    const s = skill.toLowerCase();
    if (!description.includes(s)) continue;

    if (coreSkills.includes(s)) matchedCore += 1;
    else if (secondarySkills.includes(s)) matchedSecondary += 1;
    else matchedSecondary += 1;
  }

  skillsScore += matchedCore * 4;
  skillsScore += matchedSecondary * 2;

  if (context.resumeSkills.length > 0 && matchedCore === 0) {
    skillsScore -= 10;
  }

  const preferred = context.preferredLocation.toLowerCase();
  const normalizedLocation = location.toLowerCase();

  if (context.remoteOnly) {
    if (normalizedLocation.includes("remote")) locationScore += 12;
    else locationScore -= 10;
  } else {
    if (preferred && normalizedLocation.includes(preferred)) {
      locationScore += 12;
    } else if (
      preferred &&
      preferred.split(",").some((part) => {
        const p = part.trim();
        return p.length > 2 && normalizedLocation.includes(p);
      })
    ) {
      locationScore += 8;
    } else if (normalizedLocation.includes("remote")) {
      locationScore += 6;
    } else if (isNearbyLocation(normalizedLocation, preferred)) {
      locationScore += 5;
    } else {
      locationScore -= 4;
    }
  }

  if ((job.salary_min ?? 0) > 0 || (job.salary_max ?? 0) > 0) {
    qualityScore += 2;
  }

  if (company.trim().length > 1) {
    qualityScore += 2;
  }

  if ((job.description || "").length > 400) {
    qualityScore += 2;
  }

  if (looksSpammy(description)) {
    qualityScore -= 8;
  }

  return titleScore + seniorityScore + skillsScore + locationScore + qualityScore;
}

function quickFit(
  job: AdzunaJob,
  context: {
    resumeSkills: string[];
    targetTitles: string[];
    seniority: "entry" | "mid" | "senior";
    preferredLocation: string;
    remoteOnly: boolean;
  }
): {
  fitScore: number;
  reasons: string[];
  gaps: string[];
  recommendation: "apply" | "maybe" | "skip";
} {
  const rawScore = scoreJob(job, context);
  const title = (job.title || "").toLowerCase();
  const description = (job.description || "").toLowerCase();
  const location = (job.location?.display_name || "").toLowerCase();

  const reasons: string[] = [];
  const gaps: string[] = [];

  const strongTitleMatch = context.targetTitles.some((t) => {
    const target = t.toLowerCase();
    return (
      title.includes(target) ||
      tokenOverlap(title, target) >= 0.6 ||
      isAdjacentTitle(title, target)
    );
  });

  if (strongTitleMatch) {
    reasons.push("Title aligns closely with your target roles");
  }

  const matchedSkills = context.resumeSkills.filter((skill) =>
    description.includes(skill.toLowerCase())
  );

  if (matchedSkills.length >= 3) {
    reasons.push(`Strong overlap with skills like ${matchedSkills.slice(0, 3).join(", ")}`);
  } else if (matchedSkills.length >= 1) {
    reasons.push(`Some direct overlap with ${matchedSkills.slice(0, 2).join(", ")}`);
  }

  if (context.remoteOnly && location.includes("remote")) {
    reasons.push("Matches your remote preference");
  } else if (
    !context.remoteOnly &&
    context.preferredLocation &&
    location.includes(context.preferredLocation.toLowerCase())
  ) {
    reasons.push("Matches your preferred location");
  }

  const seniorityText = `${title} ${description}`;

  if (
    context.seniority === "entry" &&
    /\b(senior|staff|lead|principal|director|manager|architect)\b/.test(seniorityText)
  ) {
    gaps.push("This role may be too senior");
  }

  if (
    context.seniority === "mid" &&
    /\b(staff|principal|director)\b/.test(seniorityText)
  ) {
    gaps.push("This role may be slightly above your current level");
  }

  if (
    context.seniority === "senior" &&
    /\b(junior|jr\b|entry level|intern|new grad)\b/.test(seniorityText)
  ) {
    gaps.push("This role may be below your experience level");
  }

  const missingCore = [
    "python",
    "javascript",
    "typescript",
    "react",
    "node",
    "sql",
    "aws",
    "docker",
    "machine learning",
    "llm",
    "rag",
  ].filter(
    (skill) =>
      description.includes(skill) &&
      !context.resumeSkills.map((s) => s.toLowerCase()).includes(skill)
  );

  if (missingCore.length >= 2) {
    gaps.push(`Missing skills like ${missingCore.slice(0, 3).join(", ")}`);
  }

  while (reasons.length < 2) {
    if (!reasons.includes("Relevant engineering background")) {
      reasons.push("Relevant engineering background");
    } else {
      break;
    }
  }

  const fitScore = Math.max(0, Math.min(100, Math.round(50 + rawScore)));

  let recommendation: "apply" | "maybe" | "skip" = "maybe";

  if (fitScore >= 85 && gaps.length === 0) {
    recommendation = "apply";
  } else if (fitScore >= 75 && gaps.length <= 1) {
    recommendation = "apply";
  } else if (fitScore >= 65) {
    recommendation = "maybe";
  } else {
    recommendation = "skip";
  }

  if (
    gaps.some((g) => g.toLowerCase().includes("too senior")) &&
    fitScore < 80
  ) {
    recommendation = "skip";
  }

  return {
    fitScore,
    reasons: reasons.slice(0, 2),
    gaps: gaps.slice(0, 2),
    recommendation,
  };
}

function tokenOverlap(a: string, b: string): number {
  const aTokens = new Set(a.split(/\W+/).filter(Boolean));
  const bTokens = new Set(b.split(/\W+/).filter(Boolean));

  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }

  return overlap / Math.max(aTokens.size, bTokens.size);
}

function isAdjacentTitle(jobTitle: string, targetTitle: string): boolean {
  const adjacencyMap: Record<string, string[]> = {
    "software engineer": ["full stack engineer", "backend engineer", "frontend engineer", "software developer"],
    "full stack engineer": ["software engineer", "backend engineer", "frontend engineer", "full stack developer"],
    "backend engineer": ["software engineer", "platform engineer", "python developer"],
    "frontend engineer": ["react developer", "ui engineer", "software engineer"],
    "ai engineer": ["machine learning engineer", "applied ai engineer", "python developer"],
    "machine learning engineer": ["ai engineer", "applied ai engineer", "data scientist"],
  };

  for (const [base, related] of Object.entries(adjacencyMap)) {
    if (targetTitle.includes(base) && related.some((relatedTitle) => jobTitle.includes(relatedTitle))) {
      return true;
    }
  }

  return false;
}

function isNearbyLocation(jobLocation: string, preferredLocation: string): boolean {
  if (!preferredLocation) return false;

  const pairs = [
    ["los angeles", "california"],
    ["marina del rey", "los angeles"],
    ["santa monica", "los angeles"],
    ["new york city", "new york"],
    ["san francisco", "california"],
  ];

  return pairs.some(
    ([a, b]) =>
      (preferredLocation.includes(a) && jobLocation.includes(b)) ||
      (preferredLocation.includes(b) && jobLocation.includes(a))
  );
}

function looksSpammy(description: string): boolean {
  return (
    description.length < 120 ||
    /click here|limited time|urgent hiring|weekly payout|no experience needed/i.test(description)
  );
}