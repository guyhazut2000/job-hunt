import type { ApplicationStatus, EmailConfidence } from "@prisma/client";
import { bestCompany, bestJob, companySimilarity, titleSimilarity, type CompanyLike, type JobLike } from "./match";
import { classify, companyFromDomain, extract, isAtsSender, parseFrom, statusForKind, type MailMessage } from "./parse";
import { COMPANY_MATCH, JOB_MATCH, REVIEW_FLOOR, nextStatus, scoreCandidate, shouldAutoApply } from "./score";

export type AppLike = { id: string; jobId: string | null; company: string; title: string; status: ApplicationStatus };

export type AnalyzeContext = {
  confidence: EmailConfidence;
  detectStatusUpdates: boolean;
  companies: CompanyLike[];
  jobs: JobLike[];
  applications: AppLike[];
};

export type Action =
  | "create" // new Application (auto)
  | "update" // existing Application status change (auto)
  | "review" // goes to the pending review queue
  | "duplicate" // already on the board, nothing to do
  | "skip"; // not relevant / too weak

export type Analysis = {
  kind: "APPLICATION" | "STATUS_UPDATE";
  detectedStatus: ApplicationStatus;
  company: string | null;
  title: string | null;
  matchedJobId: string | null;
  matchedCompanyId: string | null;
  applicationId: string | null;
  newStatus: ApplicationStatus | null;
  confidence: number;
  reasons: string[];
  action: Action;
};

export function findApplication(
  apps: AppLike[],
  company: string | null,
  title: string | null,
  jobId: string | null,
): { app: AppLike; score: number } | null {
  if (jobId) {
    const byJob = apps.find((a) => a.jobId === jobId);
    if (byJob) return { app: byJob, score: 1 };
  }
  if (!company) return null;
  const sameCompany = apps
    .map((a) => ({ app: a, c: companySimilarity(company, a.company) }))
    .filter((x) => x.c >= COMPANY_MATCH);
  if (!sameCompany.length) return null;
  if (title) {
    const ranked = sameCompany
      .map((x) => ({ app: x.app, score: titleSimilarity(title, x.app.title) }))
      .sort((a, b) => b.score - a.score);
    if (ranked[0].score >= JOB_MATCH) return ranked[0];
    return null;
  }
  // No title in the email: only unambiguous when there's a single application at that company.
  return sameCompany.length === 1 ? { app: sameCompany[0].app, score: 0.7 } : null;
}

export function analyzeMessage(msg: MailMessage, ctx: AnalyzeContext): Analysis | null {
  const cls = classify(msg);
  if (!cls.kind) return null;
  const isStatus = cls.kind !== "APPLICATION";
  if (isStatus && !ctx.detectStatusUpdates) return null;

  const from = parseFrom(msg.from);
  const ex = extract(msg);
  const companyHit = bestCompany(ex.company, ctx.companies, companyFromDomain(from));
  const companyOk = companyHit && companyHit.score >= COMPANY_MATCH ? companyHit.company : null;
  const jobs = companyOk ? ctx.jobs.filter((j) => j.companyId === companyOk.id) : [];
  const jobHit = bestJob(ex.title, jobs);
  const job = jobHit && jobHit.score >= JOB_MATCH ? jobHit.job : null;

  const company = companyOk?.name ?? ex.company;
  const title = jobHit && jobHit.score >= 0.75 ? jobHit.job.title : (ex.title ?? (job ? job.title : null));
  const existing = findApplication(ctx.applications, company, title, job?.id ?? null);

  const { score, reasons } = scoreCandidate({
    strongPhrase: cls.strong,
    atsSender: isAtsSender(from),
    companySource: ex.companySource,
    companyMatch: companyHit?.score ?? 0,
    hasTitle: Boolean(ex.title),
    jobMatch: Math.max(jobHit?.score ?? 0, isStatus && existing ? existing.score : 0),
  });
  if (isStatus && existing) reasons.push("application_match");

  const detectedStatus = statusForKind(cls.kind);
  const base = {
    kind: isStatus ? ("STATUS_UPDATE" as const) : ("APPLICATION" as const),
    detectedStatus,
    company,
    title,
    matchedJobId: job?.id ?? null,
    matchedCompanyId: companyOk?.id ?? null,
    applicationId: existing?.app.id ?? null,
    confidence: score,
    reasons,
  };
  const auto = shouldAutoApply(score, ctx.confidence);

  if (existing) {
    // "Applied" confirmation for something already saved on the board moves it to APPLIED.
    const target = nextStatus(existing.app.status, detectedStatus);
    if (!target) return { ...base, newStatus: null, action: "duplicate" };
    return { ...base, newStatus: target, action: auto ? "update" : "review" };
  }
  if (score < REVIEW_FLOOR || !company)
    return { ...base, newStatus: null, action: score < REVIEW_FLOOR ? "skip" : "review" };
  if (isStatus) return { ...base, newStatus: detectedStatus, action: "review" };
  return { ...base, newStatus: "APPLIED", action: auto ? "create" : "review" };
}
