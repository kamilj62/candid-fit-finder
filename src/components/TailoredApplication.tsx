import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Copy, Check, FileText, Mail } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { type Job } from "@/components/JobCard";

interface Props {
  job: Job;
  resume: string;
}

const TailoredApplication = ({ job, resume }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ resume: string; cover_letter: string } | null>(null);
  const [copied, setCopied] = useState<"resume" | "cover" | null>(null);

  const generate = async () => {
    if (!resume.trim()) {
      toast({ variant: "destructive", title: "No resume", description: "Add your resume first." });
      return;
    }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("tailor-application", {
        body: { resume, job },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      setData(res);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message || "Try again" });
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, which: "resume" | "cover") => {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!data) {
    return (
      <Button
        onClick={generate}
        disabled={loading}
        size="sm"
        className="w-full font-mono text-xs"
        variant="outline"
      >
        {loading ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Tailoring...</>
        ) : (
          <><Sparkles className="h-3.5 w-3.5" /> Tailor Resume & Cover Letter</>
        )}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-md bg-secondary/30 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="flex items-center gap-1.5 font-mono text-xs font-medium text-primary uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5" /> Tailored Resume
          </span>
          <Button variant="ghost" size="sm" onClick={() => copy(data.resume, "resume")} className="h-6 px-2">
            {copied === "resume" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span className="text-xs ml-1">{copied === "resume" ? "Copied" : "Copy"}</span>
          </Button>
        </div>
        <div className="p-3 text-sm text-foreground/80 prose prose-sm max-w-none prose-headings:text-foreground prose-headings:font-mono prose-strong:text-foreground prose-p:text-foreground/80 prose-li:text-foreground/80">
          <ReactMarkdown>{data.resume}</ReactMarkdown>
        </div>
      </div>

      <div className="border border-border rounded-md bg-secondary/30 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="flex items-center gap-1.5 font-mono text-xs font-medium text-primary uppercase tracking-wider">
            <Mail className="h-3.5 w-3.5" /> Cover Letter
          </span>
          <Button variant="ghost" size="sm" onClick={() => copy(data.cover_letter, "cover")} className="h-6 px-2">
            {copied === "cover" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            <span className="text-xs ml-1">{copied === "cover" ? "Copied" : "Copy"}</span>
          </Button>
        </div>
        <div className="p-3 text-sm text-foreground/80 whitespace-pre-wrap font-body">
          {data.cover_letter}
        </div>
      </div>

      <Button onClick={generate} disabled={loading} size="sm" variant="ghost" className="w-full font-mono text-xs">
        {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Regenerating...</> : <><Sparkles className="h-3.5 w-3.5" /> Regenerate</>}
      </Button>
    </div>
  );
};

export default TailoredApplication;
