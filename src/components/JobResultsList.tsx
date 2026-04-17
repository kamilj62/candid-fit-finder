import JobCard, { type Job } from "@/components/JobCard";

interface JobResultsListProps {
  jobs: Job[];
  resume: string;
}

const JobResultsList = ({ jobs, resume }: JobResultsListProps) => {
  const avgScore = Math.round(jobs.reduce((sum, j) => sum + j.match_score, 0) / jobs.length);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Found {jobs.length} Jobs
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          Avg fit: <span className="text-primary font-semibold">{avgScore}%</span>
        </span>
      </div>

      <div className="space-y-3">
        {jobs.map((job, i) => (
          <JobCard key={i} job={job} rank={i + 1} resume={resume} />
        ))}
      </div>
    </div>
  );
};

export default JobResultsList;
