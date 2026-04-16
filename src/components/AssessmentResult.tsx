import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface AssessmentResultProps {
  assessment: string;
}

const AssessmentResult = ({ assessment }: AssessmentResultProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(assessment);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-8 border border-border rounded-md bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
        <span className="font-mono text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Assessment Output
        </span>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="text-muted-foreground hover:text-foreground">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="text-xs ml-1">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <div className="p-5 prose-assessment font-body text-sm leading-relaxed whitespace-pre-wrap">
        <ReactMarkdown>{assessment}</ReactMarkdown>
      </div>
    </div>
  );
};

export default AssessmentResult;
