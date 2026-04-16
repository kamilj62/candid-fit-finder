import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AssessmentForm from "@/components/AssessmentForm";
import AssessmentResult from "@/components/AssessmentResult";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [assessment, setAssessment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (jobDescription: string, resume: string) => {
    setIsLoading(true);
    setAssessment(null);

    try {
      const { data, error } = await supabase.functions.invoke("assess-fit", {
        body: { jobDescription, resume },
      });

      if (error) throw error;

      setAssessment(data.assessment);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Assessment failed",
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
            Honest Fit Assessor
          </h1>
          <p className="mt-2 font-body text-sm text-muted-foreground leading-relaxed max-w-lg">
            Paste a job description and a candidate's background. Get a brutally honest assessment of whether there's a real fit — no spin, no fluff.
          </p>
        </header>

        <AssessmentForm onSubmit={handleSubmit} isLoading={isLoading} />

        {assessment && <AssessmentResult assessment={assessment} />}
      </div>
    </div>
  );
};

export default Index;
