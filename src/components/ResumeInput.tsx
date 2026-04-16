import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search } from "lucide-react";

interface ResumeInputProps {
  onSubmit: (resume: string) => void;
  isLoading: boolean;
}

const ResumeInput = ({ onSubmit, isLoading }: ResumeInputProps) => {
  const [resume, setResume] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resume.trim()) onSubmit(resume);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="block font-mono text-sm font-medium text-primary">
          Your Resume / Background
        </label>
        <Textarea
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          placeholder="Paste your resume, LinkedIn summary, or describe your skills and experience..."
          className="min-h-[200px] bg-card border-border font-body text-sm text-foreground placeholder:text-muted-foreground resize-y"
          required
        />
      </div>

      <Button
        type="submit"
        disabled={isLoading || !resume.trim()}
        className="w-full font-mono text-sm font-semibold"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" />
            Searching for Jobs...
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Find Matching Jobs
          </>
        )}
      </Button>
    </form>
  );
};

export default ResumeInput;
