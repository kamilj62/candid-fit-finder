import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ResumeInput from "@/components/ResumeInput";
import JobResultsList from "@/components/JobResultsList";
import { type Job } from "@/components/JobCard";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resume, setResume] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (resumeText: string) => {
    setIsLoading(true);
    setJobs([]);
    setResume(resumeText);

    try {
      const { data, error } = await supabase.functions.invoke("search-jobs", {
        body: { resume: resumeText },
      });

      if (error) throw error;

      if (data?.jobs && Array.isArray(data.jobs)) {
        setJobs(data.jobs);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Search failed",
        description: err.message || "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
        <header className="mb-10">
          <h1 className="font-mono text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Job Fit Finder
          </h1>
          <p className="mt-2 font-body text-sm text-muted-foreground leading-relaxed max-w-lg">
            Paste your resume and let AI find matching jobs — ranked by fit with brutally honest assessments.
          </p>
        </header>

        <ResumeInput onSubmit={handleSearch} isLoading={isLoading} />

        {jobs.length > 0 && <JobResultsList jobs={jobs} resume={resume} />}
      </div>
    </div>
  );
};

export default Index;
