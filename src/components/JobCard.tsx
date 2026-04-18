import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TailoredApplication from "@/components/TailoredApplication";

export interface Job {
  title: string;
  company: string;
  location: string;
  description?: string;
  url?: string;
  source?: string;
  postedDate?: string | null;
  category?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  score?: number;
  fitScore: number;
  reasons: string[];
  gaps: string[];
  recommendation: "apply" | "maybe" | "skip";
}

const getScoreColor = (score: number) => {
  if (score >= 85) return "text-green-400";
  if (score >= 70) return "text-yellow-400";
  return "text-red-400";
};

const getScoreBg = (score: number) => {
  if (score >= 85) return "bg-green-400/10 border-green-400/20";
  if (score >= 70) return "bg-yellow-400/10 border-yellow-400/20";
  return "bg-red-400/10 border-red-400/20";
};

const getRecommendationLabel = (recommendation: Job["recommendation"]) => {
  if (recommendation === "apply") return "Apply";
  if (recommendation === "maybe") return "Maybe";
  return "Skip";
};

const getRecommendationClasses = (recommendation: Job["recommendation"]) => {
  if (recommendation === "apply") {
    return "bg-green-400/10 text-green-400 border-green-400/20";
  }
  if (recommendation === "maybe") {
    return "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
  }
  return "bg-red-400/10 text-red-400 border-red-400/20";
};

const getFitLabel = (score: number) => {
  if (score >= 85) return "Strong Fit";
  if (score >= 70) return "Good Fit";
  return "Stretch";
};

const formatSalary = (salaryMin?: number | null, salaryMax?: number | null) => {
  const fmt = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  if (salaryMin && salaryMax) return `${fmt(salaryMin)} - ${fmt(salaryMax)}`;
  if (salaryMin) return `${fmt(salaryMin)}+`;
  if (salaryMax) return `Up to ${fmt(salaryMax)}`;
  return "N/A";
};

const getJobLink = (job: Job) => job.url || "";

const getJobLinkLabel = (url: string) => {
  if (!url) return "Link unavailable";

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("indeed.")) return "Open on Indeed";
    if (hostname.includes("adzuna.")) return "Open on Adzuna";
    if (hostname.includes("linkedin.")) return "Open on LinkedIn";
    if (hostname.includes("greenhouse.")) return "Open on Greenhouse";
    if (hostname.includes("lever.")) return "Open on Lever";
    return "Open Job Posting";
  } catch {
    return "Open Job Posting";
  }
};

const JobCard = ({
  job,
  rank,
  resume,
}: {
  job: Job;
  rank: number;
  resume: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const jobLink = getJobLink(job);
  const linkLabel = getJobLinkLabel(jobLink);
  const salaryText = formatSalary(job.salaryMin, job.salaryMax);

  return (
    <div className="border border-border rounded-md bg-card overflow-hidden transition-all duration-200 hover:border-primary/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-4 flex items-start gap-4"
      >
        <div
          className={cn(
            "shrink-0 w-12 h-12 rounded-md border flex items-center justify-center font-mono text-lg font-bold",
            getScoreBg(job.fitScore),
            getScoreColor(job.fitScore)
          )}
        >
          {job.fitScore}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{rank}</span>
            <h3 className="font-mono text-sm font-semibold text-foreground truncate">
              {job.title}
            </h3>
          </div>

          <p className="text-xs text-muted-foreground mt-0.5">{job.company}</p>

          <div className="mt-1">
            <span
              className={cn(
                "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider",
                getRecommendationClasses(job.recommendation)
              )}
            >
              {getRecommendationLabel(job.recommendation)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>

            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {salaryText}
            </span>

            <span className={cn("font-mono", getScoreColor(job.fitScore))}>
              {getFitLabel(job.fitScore)}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border space-y-4">
          {job.description && (
            <p className="text-sm text-foreground/80 mt-3 whitespace-pre-line">
              {job.description}
            </p>
          )}

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              <span className="font-mono text-xs font-medium text-green-400 uppercase tracking-wider">
                Why it matches
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {job.reasons.map((reason, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs rounded bg-green-400/10 text-green-400 border border-green-400/20"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>

          {job.gaps.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                <span className="font-mono text-xs font-medium text-red-400 uppercase tracking-wider">
                  Potential gaps
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {job.gaps.map((gap, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs rounded bg-red-400/10 text-red-400 border border-red-400/20"
                  >
                    {gap}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-secondary/50 rounded-md p-3 border border-border">
            <span className="font-mono text-xs font-medium text-primary uppercase tracking-wider block mb-1.5">
              Fit Summary
            </span>
            <p className="text-sm text-foreground/80">
              This role is rated <span className="font-semibold">{job.fitScore}/100</span> based
              on title match, skills overlap, seniority fit, and location alignment.
            </p>
          </div>

          {jobLink ? (
            <a
              href={jobLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-mono text-xs font-medium"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {linkLabel}
            </a>
          ) : (
            <div className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-md border border-border bg-muted/30 text-muted-foreground font-mono text-xs font-medium">
              <ExternalLink className="h-3.5 w-3.5" />
              Link unavailable
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <TailoredApplication job={job} resume={resume} />
          </div>
        </div>
      )}
    </div>
  );
};

export default JobCard;