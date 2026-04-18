# Candid Fit Finder

An AI-powered job matching tool that gives you **brutally honest** assessments of how well you fit a role — including when you don't.

Most job tools tell you what you want to hear. This one doesn't.

![Job Fit Finder](public/placeholder.svg)

---

## What It Does

1. **Paste your resume** — drop in your experience as plain text
2. **Get matched jobs** — AI generates 5–8 realistic job listings ranked by fit score
3. **See honest assessments** — each listing includes a candid first-person evaluation of gaps and strengths
4. **Assess a specific role** — paste any job description for a detailed fit breakdown
5. **Tailor your application** — get a rewritten resume and cover letter targeted to a specific job

---

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase Edge Functions (Deno)
- **AI:** Claude Sonnet (Anthropic API)
- **Build:** Vite
- **Deployment:** Lovable + Supabase

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- An [Anthropic API key](https://console.anthropic.com)

### 1. Clone the repo

```bash
git clone https://github.com/kamilj62/candid-fit-finder.git
cd candid-fit-finder
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root (or update the existing one):

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

### 4. Add your Anthropic API key to Supabase secrets

In your [Supabase dashboard](https://supabase.com/dashboard) → Edge Functions → Secrets:

```
ANTHROPIC_API_KEY=sk-ant-...
```

> ⚠️ Never put your Anthropic API key in the frontend or commit it to git. It must live in Supabase secrets only.

### 5. Deploy the edge functions

```bash
supabase functions deploy assess-fit
supabase functions deploy search-jobs
supabase functions deploy tailor-application
```

### 6. Run locally

```bash
npm run dev
```

---

## Edge Functions

All AI logic runs server-side in Supabase Edge Functions. The frontend never touches the API key directly.

| Function | Endpoint | Description |
|---|---|---|
| `search-jobs` | `/functions/v1/search-jobs` | Analyzes resume, returns 5–8 matched job listings with fit scores |
| `assess-fit` | `/functions/v1/assess-fit` | Takes a job description + resume, returns a structured honest assessment |
| `tailor-application` | `/functions/v1/tailor-application` | Rewrites resume and generates cover letter for a specific job |

---

## Project Structure

```
candid-fit-finder/
├── src/
│   ├── components/
│   │   ├── ResumeInput.tsx        # Resume paste input
│   │   ├── JobCard.tsx            # Individual job listing card
│   │   ├── JobResultsList.tsx     # List of matched jobs
│   │   ├── AssessmentForm.tsx     # JD paste + assess fit form
│   │   ├── AssessmentResult.tsx   # Honest fit assessment display
│   │   └── TailoredApplication.tsx # Resume + cover letter output
│   ├── pages/
│   │   └── Index.tsx              # Main page
│   └── integrations/
│       └── supabase/              # Supabase client + types
├── supabase/
│   └── functions/
│       ├── assess-fit/            # Fit assessment edge function
│       ├── search-jobs/           # Job search edge function
│       └── tailor-application/    # Application tailoring edge function
└── public/
```

---

## How the Honesty Works

The AI is explicitly instructed to **not** oversell you. Key rules baked into the system prompts:

- If there are 3+ major gaps → verdict is "Probably Not Your Person"
- Missing a required skill → states it directly: "I don't have this"
- No hedging phrases like "I believe I could learn quickly"
- Match scores are not inflated — a 65 means 65

The goal is to help you spend time on roles that are actually good fits, and skip the ones that aren't.

---

## Deployment

This project is deployed via [Lovable](https://lovable.dev) connected to Supabase. To deploy your own version:

1. Fork this repo
2. Create a new Lovable project and connect it to your GitHub
3. Connect your Supabase project
4. Add `ANTHROPIC_API_KEY` to your Supabase secrets
5. Deploy edge functions via Supabase CLI

---

## Author

**Joseph Kamil** — AI/ML Engineer based in Los Angeles, CA

- GitHub: [@kamilj62](https://github.com/kamilj62)
- Email: kamilj@umich.edu

---

## License

MIT
