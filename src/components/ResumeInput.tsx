import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search } from "lucide-react";

interface ResumeInputProps {
  onSubmit: (
    resume: string,
    preferredLocation: string,
    searchMode: "both" | "remote" | "nearby"
  ) => void;
  isLoading: boolean;
}

const ResumeInput = ({ onSubmit, isLoading }: ResumeInputProps) => {
  const [resume, setResume] = useState("");
  const [preferredLocation, setPreferredLocation] = useState("");
  const [searchMode, setSearchMode] = useState<"both" | "remote" | "nearby">("both");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resume.trim()) {
      onSubmit(resume.trim(), preferredLocation.trim(), searchMode);
    }
  };

  const isRemoteOnly = searchMode === "remote";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="block font-mono text-sm font-medium text-primary">
          Preferred Location
        </label>
        <Input
          value={preferredLocation}
          onChange={(e) => setPreferredLocation(e.target.value)}
          placeholder={
            isRemoteOnly
              ? "Not needed for remote-only search"
              : "City, State (example: Los Angeles, CA)"
          }
          disabled={isRemoteOnly}
          className="bg-card border-border font-body text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground">
          {isRemoteOnly
            ? "Remote-only search ignores location."
            : "Used to rank nearby and location-relevant jobs."}
        </p>
      </div>

      <div className="space-y-2">
        <label className="block font-mono text-sm font-medium text-primary">
          Search Type
        </label>
        <select
          value={searchMode}
          onChange={(e) => setSearchMode(e.target.value as "both" | "remote" | "nearby")}
          className="w-full h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground"
        >
          <option value="both">Remote + Near me</option>
          <option value="remote">Remote only</option>
          <option value="nearby">Near me only</option>
        </select>
      </div>

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
        <p className="text-xs text-muted-foreground">
          The app uses this to infer likely roles, seniority, skills, and fit.
        </p>
      </div>

      <Button
        type="submit"
        disabled={isLoading || !resume.trim()}
        className="w-full font-mono text-sm font-semibold"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin h-4 w-4" />
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