import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Sparkles,
  Copy,
  Check,
  FileText,
  Mail,
  Download,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { type Job } from "@/components/JobCard";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

interface Props {
  job: Job;
  resume: string;
}

interface TailoredApplicationResponse {
  resume: string;
  cover_letter: string;
  error?: string;
}

const TailoredApplication = ({ job, resume }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TailoredApplicationResponse | null>(null);
  const [copied, setCopied] = useState<"resume" | "cover" | null>(null);

  const generate = async () => {
    if (!resume.trim()) {
      toast({
        variant: "destructive",
        title: "No resume",
        description: "Add your resume first.",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: res, error } = await supabase.functions.invoke("tailor-application", {
        body: {
          resume,
          job,
        },
      });

      if (error) throw error;
      if (res?.error) throw new Error(res.error);

      if (!res?.resume || !res?.cover_letter) {
        throw new Error("Invalid response from tailor-application");
      }

      setData({
        resume: res.resume,
        cover_letter: res.cover_letter,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: err?.message || "Try again",
      });
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, which: "resume" | "cover") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Could not copy to clipboard.",
      });
    }
  };

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

  const markdownToPlainLines = (text: string) => {
    return text
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .split("\n")
      .map((line) => line.trimEnd());
  };

  const downloadDocx = async (content: string, filename: string, title: string) => {
    try {
      const lines = markdownToPlainLines(content);

      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    size: 28,
                  }),
                ],
                spacing: { after: 300 },
              }),
              ...lines.map(
                (line) =>
                  new Paragraph({
                    children: [new TextRun(line || " ")],
                    spacing: { after: 120 },
                  })
              ),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, filename);
    } catch {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: "Could not generate Word document.",
      });
    }
  };

  const downloadPdf = (content: string, filename: string, title: string) => {
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "letter",
      });

      const margin = 40;
      const maxWidth = 530;
      const lineHeight = 18;
      let y = 50;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text(title, margin, y);
      y += 30;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);

      const lines = pdf.splitTextToSize(
        markdownToPlainLines(content).join("\n"),
        maxWidth
      );

      for (const line of lines) {
        if (y > 740) {
          pdf.addPage();
          y = 50;
        }
        pdf.text(line, margin, y);
        y += lineHeight;
      }

      pdf.save(filename);
    } catch {
      toast({
        variant: "destructive",
        title: "Download failed",
        description: "Could not generate PDF.",
      });
    }
  };

  const baseName = slugify(job.title || "application");

  const downloadResumeDocx = async () => {
    if (!data?.resume) return;
    await downloadDocx(data.resume, `${baseName}-resume.docx`, "Tailored Resume");
  };

  const downloadCoverDocx = async () => {
    if (!data?.cover_letter) return;
    await downloadDocx(
      data.cover_letter,
      `${baseName}-cover-letter.docx`,
      "Cover Letter"
    );
  };

  const downloadResumePdf = () => {
    if (!data?.resume) return;
    downloadPdf(data.resume, `${baseName}-resume.pdf`, "Tailored Resume");
  };

  const downloadCoverPdf = () => {
    if (!data?.cover_letter) return;
    downloadPdf(data.cover_letter, `${baseName}-cover-letter.pdf`, "Cover Letter");
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
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Tailoring...
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Tailor Resume & Cover Letter
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-md bg-secondary/30 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="flex items-center gap-1.5 font-mono text-xs font-medium text-primary uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5" />
            Tailored Resume
          </span>

          <div className="flex items-center gap-1 flex-wrap justify-end">
            <Button variant="ghost" size="sm" onClick={downloadResumeDocx} className="h-6 px-2">
              <Download className="h-3 w-3" />
              <span className="text-xs ml-1">Word</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={downloadResumePdf} className="h-6 px-2">
              <Download className="h-3 w-3" />
              <span className="text-xs ml-1">PDF</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(data.resume, "resume")}
              className="h-6 px-2"
            >
              {copied === "resume" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span className="text-xs ml-1">{copied === "resume" ? "Copied" : "Copy"}</span>
            </Button>
          </div>
        </div>

        <div className="p-3 text-sm text-foreground/80 prose prose-sm max-w-none prose-headings:text-foreground prose-headings:font-mono prose-strong:text-foreground prose-p:text-foreground/80 prose-li:text-foreground/80">
          <ReactMarkdown>{data.resume}</ReactMarkdown>
        </div>
      </div>

      <div className="border border-border rounded-md bg-secondary/30 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="flex items-center gap-1.5 font-mono text-xs font-medium text-primary uppercase tracking-wider">
            <Mail className="h-3.5 w-3.5" />
            Cover Letter
          </span>

          <div className="flex items-center gap-1 flex-wrap justify-end">
            <Button variant="ghost" size="sm" onClick={downloadCoverDocx} className="h-6 px-2">
              <Download className="h-3 w-3" />
              <span className="text-xs ml-1">Word</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={downloadCoverPdf} className="h-6 px-2">
              <Download className="h-3 w-3" />
              <span className="text-xs ml-1">PDF</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(data.cover_letter, "cover")}
              className="h-6 px-2"
            >
              {copied === "cover" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span className="text-xs ml-1">{copied === "cover" ? "Copied" : "Copy"}</span>
            </Button>
          </div>
        </div>

        <div className="p-3 text-sm text-foreground/80 whitespace-pre-wrap font-body">
          {data.cover_letter}
        </div>
      </div>

      <Button
        onClick={generate}
        disabled={loading}
        size="sm"
        variant="ghost"
        className="w-full font-mono text-xs"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Regenerating...
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Regenerate
          </>
        )}
      </Button>
    </div>
  );
};

export default TailoredApplication;