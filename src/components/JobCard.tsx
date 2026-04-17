import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, DollarSign, TrendingUp, TrendingDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import TailoredApplication from "@/components/TailoredApplication";

export interface Job {
  title: string;
  company: string;
  location: string;
  salary_range: string;
  match_score: number;
  key_matches: string[];
  key_gaps: string[];
  summary: string;
  why_good_fit: string;
  honest_assessment: string;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-400";
  if (score >= 65) return "text-yellow-400";
  return "text-red-400";
};

const getScoreBg = (score: number) => {
  if (score >= 80) return "bg-green-400/10 border-green-400/20";
  if (score >= 65) return "bg-yellow-400/10 border-yellow-400/20";
  return "bg-red-400/10 border-red-400/20";
};

const JobCard = ({ job, rank, resume }: { job: Job; rank: number; resume: string }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border border-border rounded-md bg-card overflow-hidden transition-all duration-200 hover:border-primary/30"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-4 flex items-start gap-4"
      >
        <div className={cn(
          "shrink-0 w-12 h-12 rounded-md border flex items-center justify-center font-mono text-lg font-bold",
          getScoreBg(job.match_score),
          getScoreColor(job.match_score)
        )}>
          {job.match_score}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{rank}</span>
            <h3 className="font-mono text-sm font-semibold text-foreground truncate">{job.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{job.company}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
            <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{job.salary_range}</span>
          </div>
        </div>

        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border space-y-4">
          <p className="text-sm text-foreground/80 mt-3">{job.summary}</p>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              <span className="font-mono text-xs font-medium text-green-400 uppercase tracking-wider">Matches</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {job.key_matches.map((m, i) => (
                <span key={i} className="px-2 py-0.5 text-xs rounded bg-green-400/10 text-green-400 border border-green-400/20">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {job.key_gaps.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                <span className="font-mono text-xs font-medium text-red-400 uppercase tracking-wider">Gaps</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {job.key_gaps.map((g, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs rounded bg-red-400/10 text-red-400 border border-red-400/20">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-secondary/50 rounded-md p-3 border border-border">
            <span className="font-mono text-xs font-medium text-primary uppercase tracking-wider block mb-1.5">
              Honest Assessment
            </span>
            <p className="text-sm text-foreground/80 italic">{job.honest_assessment}</p>
          </div>

          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">Why it fits:</span> {job.why_good_fit}
          </p>

          <a
            href={`https://www.indeed.com/jobs?q=${encodeURIComponent(`${job.title} ${job.company}`)}&l=${encodeURIComponent(job.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-mono text-xs font-medium"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Find on Indeed
          </a>

          <div className="pt-2 border-t border-border">
            <TailoredApplication job={job} resume={resume} />
          </div>
        </div>
      )}
    </div>
  );
};

export default JobCard;
