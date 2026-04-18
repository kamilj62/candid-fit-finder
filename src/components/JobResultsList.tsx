import JobCard, { type Job } from "@/components/JobCard";

interface JobResultsListProps {
  jobs: Job[];
  resume: string;
}

const Section = ({
  title,
  subtitle,
  jobs,
  resume,
  startRank,
}: {
  title: string;
  subtitle: string;
  jobs: Job[];
  resume: string;
  startRank: number;
}) => {
  if (jobs.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-mono text-base font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {jobs.map((job, i) => (
          <JobCard
            key={`${job.title}-${job.company}-${startRank + i}`}
            job={job}
            rank={startRank + i}
            resume={resume}
          />
        ))}
      </div>
    </div>
  );
};

const JobResultsList = ({ jobs, resume }: JobResultsListProps) => {
  const avgScore =
    jobs.length > 0
      ? Math.round(jobs.reduce((sum, j) => sum + j.fitScore, 0) / jobs.length)
      : 0;

  const applyJobs = jobs.filter((j) => j.recommendation === "apply");
  const maybeJobs = jobs.filter((j) => j.recommendation === "maybe");
  const skipJobs = jobs.filter((j) => j.recommendation === "skip");

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-lg font-semibold text-foreground">
          Found {jobs.length} Jobs
        </h2>

        <span className="font-mono text-xs text-muted-foreground">
          Avg fit: <span className="text-primary font-semibold">{avgScore}%</span>
        </span>
      </div>

      <Section
        title="Apply First"
        subtitle="Best matches worth your time first."
        jobs={applyJobs}
        resume={resume}
        startRank={1}
      />

      <Section
        title="Maybe"
        subtitle="Decent options if you want a wider net."
        jobs={maybeJobs}
        resume={resume}
        startRank={applyJobs.length + 1}
      />

      <Section
        title="Skip"
        subtitle="Probably not worth spending time on right now."
        jobs={skipJobs}
        resume={resume}
        startRank={applyJobs.length + maybeJobs.length + 1}
      />
    </div>
  );
};

export default JobResultsList;