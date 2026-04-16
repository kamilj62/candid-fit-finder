import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface AssessmentFormProps {
  onSubmit: (jobDescription: string, resume: string) => void;
  isLoading: boolean;
}

const AssessmentForm = ({ onSubmit, isLoading }: AssessmentFormProps) => {
  const [jobDescription, setJobDescription] = useState("");
  const [resume, setResume] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (jobDescription.trim() && resume.trim()) {
      onSubmit(jobDescription, resume);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="block font-mono text-sm font-medium text-primary">
          Job Description
        </label>
        <Textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the full job description here..."
          className="min-h-[160px] bg-card border-border font-body text-sm text-foreground placeholder:text-muted-foreground resize-y"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="block font-mono text-sm font-medium text-primary">
          Candidate Resume / Background
        </label>
        <Textarea
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          placeholder="Paste resume, LinkedIn summary, or describe your background..."
          className="min-h-[160px] bg-card border-border font-body text-sm text-foreground placeholder:text-muted-foreground resize-y"
          required
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading || !jobDescription.trim() || !resume.trim()}
        className="w-full font-mono text-sm font-semibold"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" />
            Analyzing Fit...
          </>
        ) : (
          "Run Honest Assessment"
        )}
      </Button>
    </form>
  );
};

export default AssessmentForm;
