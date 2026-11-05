import { describe, expect, it } from "vitest";
import { flagUnanswered, mergeAnswers, promptHasSecret, questionsForAi, answerPrompt } from "@/lib/auto-apply/answers";
import { classifyTarget } from "@/lib/auto-apply/classify";
import {
  apiBlocked,
  applyUserEdits,
  approveBlock,
  ashbySubmission,
  attachDocuments,
  greenhouseBody,
  leverPacket,
  mapProfile,
  parseAshbyForm,
  parseGreenhouseForm,
  profilePacket,
  sentSnapshot,
} from "@/lib/auto-apply/fields";
import { parseBoardKeys } from "@/lib/auto-apply/keys";
import { groupQueue, queueBucket } from "@/lib/auto-apply/queue";
import { APPLY_DEFAULTS, evaluateRules, parseSettingsInput, toggleBlocked } from "@/lib/auto-apply/rules";
import { submitAshby, submitGreenhouse } from "@/lib/auto-apply/submit";
import { nextZonedDay, zonedDayStart } from "@/lib/auto-apply/time";
import { blankField, type ApplyProfile } from "@/lib/auto-apply/types";
import type { AttachableDocument } from "@/lib/documents/picker";

const keys = { greenhouse: { acme: "board-key" }, ashby: { acme: "ashby-key" } };
const noKeys = { greenhouse: {}, ashby: {} };

const profile: ApplyProfile = {
  name: "Dana Levi",
  email: "dana@example.com",
  phone: "050-1234567",
  location: "תל אביב",
  linkedinUrl: "https://www.linkedin.com/in/dana",
  githubUrl: "https://github.com/dana",
  portfolioUrl: "",
  headline: "Backend engineer",
  summary: "Builds payment APIs.",
  skills: [{ name: "TypeScript", years: 4 }],
  salaryMin: 35000,
  salaryMax: 42000,
  availability: "ACTIVE",
  currentCompany: "Acme",
  currentTitle: "Backend Developer",
  yearsExperience: 4,
};

function doc(partial: Partial<AttachableDocument> & Pick<AttachableDocument, "ref" | "type">): AttachableDocument {
  return {
    id: partial.ref,
    source: partial.ref.startsWith("cv:") ? "resume" : "document",
    title: partial.title ?? partial.type,
    fileName: partial.fileName ?? "file.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
    isDefault: true,
    expired: false,
    createdAt: "2026-11-01T00:00:00.000Z",
    ...partial,
  };
}

describe("classifyTarget", () => {
  it("plans a Greenhouse post only when that board's key exists", () => {
    expect(
      classifyTarget({
        source: "GREENHOUSE",
        applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
        boardId: "acme",
        keys,
      }),
    ).toMatchObject({
      delivery: "api",
      reason: "greenhouse_api",
    });
    expect(
      classifyTarget({
        source: "GREENHOUSE",
        applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
        boardId: "acme",
        keys: noKeys,
      }),
    ).toMatchObject({
      delivery: "handoff",
      reason: "greenhouse_no_key",
    });
  });

  it("never posts to Lever, LinkedIn, or mailto, even when other keys exist", () => {
    expect(
      classifyTarget({ source: "LEVER", applyUrl: "https://jobs.lever.co/acme/1", boardId: "acme", keys }),
    ).toMatchObject({
      platform: "lever",
      delivery: "handoff",
      reason: "lever_no_submit",
    });
    expect(
      classifyTarget({ source: "GREENHOUSE", applyUrl: "https://www.linkedin.com/jobs/view/1", boardId: "acme", keys }),
    ).toMatchObject({ delivery: "manual", reason: "linkedin" });
    expect(classifyTarget({ source: "MANUAL", applyUrl: "mailto:jobs@acme.com", boardId: null, keys })).toMatchObject({
      delivery: "manual",
      reason: "email",
    });
    expect(
      classifyTarget({
        source: "WORKDAY",
        applyUrl: "https://acme.wd5.myworkdayjobs.com/x",
        boardId: "acme",
        keys: noKeys,
      }),
    ).toMatchObject({
      delivery: "manual",
      reason: "unsupported",
    });
  });

  it("plans an Ashby post only with that org's key", () => {
    expect(
      classifyTarget({ source: "ASHBY", applyUrl: "https://jobs.ashbyhq.com/acme/1", boardId: "acme", keys }),
    ).toMatchObject({
      delivery: "api",
      reason: "ashby_api",
    });
    expect(
      classifyTarget({ source: "ASHBY", applyUrl: "https://jobs.ashbyhq.com/acme/1", boardId: "acme", keys: noKeys }),
    ).toMatchObject({
      delivery: "handoff",
      reason: "ashby_no_key",
    });
  });
});

describe("rules", () => {
  it("uses the documented defaults and blocks a low score, a missing score, a blocked company, and the cap", () => {
    expect(APPLY_DEFAULTS).toEqual({ minMatchScore: 70, dailyCap: 5, fullyAutomatic: false });
    const base = {
      score: 80,
      companyId: "c1",
      blockedCompanyIds: [] as string[],
      submittedToday: 0,
      minMatchScore: 70,
      dailyCap: 5,
      override: false,
    };
    expect(evaluateRules(base).ok).toBe(true);
    expect(evaluateRules({ ...base, score: 69 }).blocks).toEqual(["below_score"]);
    expect(evaluateRules({ ...base, score: null }).blocks).toEqual(["no_score"]);
    expect(evaluateRules({ ...base, score: 69, override: true }).ok).toBe(true);
    expect(evaluateRules({ ...base, score: null, override: true }).ok).toBe(true);
    expect(evaluateRules({ ...base, blockedCompanyIds: ["c1"], override: true }).blocks).toEqual(["blocked_company"]);
    expect(evaluateRules({ ...base, submittedToday: 5 }).blocks).toEqual(["daily_cap"]);
  });

  it("parses settings without turning a missing checkbox into automatic mode", () => {
    expect(parseSettingsInput({ minMatchScore: "70", dailyCap: "5", fullyAutomatic: null })).toMatchObject({
      fullyAutomatic: false,
    });
    expect(parseSettingsInput({ minMatchScore: "70.5", dailyCap: "5", fullyAutomatic: "on" })).toEqual({
      minMatchScore: 70,
      dailyCap: 5,
      fullyAutomatic: true,
    });
    expect(toggleBlocked(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleBlocked(["a", "b"], "a", false)).toEqual(["b"]);
  });
});

describe("Israel day window", () => {
  it("starts the day at local midnight in winter and summer", () => {
    expect(zonedDayStart(new Date("2026-01-15T22:30:00Z")).toISOString()).toBe("2026-01-15T22:00:00.000Z");
    expect(zonedDayStart(new Date("2026-07-15T21:30:00Z")).toISOString()).toBe("2026-07-15T21:00:00.000Z");
    const start = zonedDayStart(new Date("2026-01-15T22:30:00Z"));
    expect(nextZonedDay(start).getTime()).toBeGreaterThan(start.getTime() + 20 * 60 * 60 * 1000);
  });
});

describe("form mapping", () => {
  const greenhouse = {
    questions: [
      { required: true, label: "First Name", fields: [{ name: "first_name", type: "input_text" }] },
      { required: true, label: "Last Name", fields: [{ name: "last_name", type: "input_text" }] },
      { required: true, label: "Email", fields: [{ name: "email", type: "input_text" }] },
      {
        required: true,
        label: "Resume",
        fields: [
          { name: "resume", type: "input_file" },
          { name: "resume_text", type: "textarea" },
        ],
      },
      { required: true, label: "Location", fields: [{ name: "location", type: "input_text" }] },
      {
        required: true,
        label: "Are you authorized to work in Israel?",
        fields: [
          {
            name: "question_9",
            type: "multi_value_single_select",
            values: [
              { value: 0, label: "No" },
              { value: 1, label: "Yes" },
            ],
          },
        ],
      },
      {
        required: false,
        label: "Years of experience with TypeScript",
        fields: [{ name: "question_3", type: "input_text" }],
      },
      { required: false, label: "Salary expectation", fields: [{ name: "question_4", type: "input_text" }] },
    ],
    location_questions: [{ required: true, label: "Latitude", fields: [{ name: "latitude", type: "input_hidden" }] }],
    demographic_questions: {
      questions: [
        {
          id: 7,
          label: "Gender",
          required: false,
          type: "multi_value_single_select",
          answer_options: [{ id: 10, label: "X" }],
        },
      ],
    },
  };

  it("parses Greenhouse questions, drops hidden coordinates and the resume textarea, and refuses to transmit demographics", () => {
    const fields = parseGreenhouseForm(greenhouse);
    expect(fields.map((f) => f.id)).toEqual([
      "first_name",
      "last_name",
      "email",
      "resume",
      "location",
      "question_9",
      "question_3",
      "question_4",
      "demographic_7",
    ]);
    expect(fields.find((f) => f.id === "resume")?.kind).toBe("file");
    expect(fields.find((f) => f.id === "location")?.transmit).toBe(false);
    expect(fields.find((f) => f.id === "question_9")?.sensitive).toBe(true);
    expect(fields.find((f) => f.id === "question_9")?.options).toEqual([
      { value: "0", label: "No" },
      { value: "1", label: "Yes" },
    ]);
    expect(fields.find((f) => f.id === "demographic_7")).toMatchObject({ sensitive: true, transmit: false });
  });

  it("fills profile facts and leaves visa blank", () => {
    const filled = mapProfile(parseGreenhouseForm(greenhouse), profile);
    expect(filled.find((f) => f.id === "first_name")?.value).toBe("Dana");
    expect(filled.find((f) => f.id === "last_name")?.value).toBe("Levi");
    expect(filled.find((f) => f.id === "email")?.value).toBe("dana@example.com");
    expect(filled.find((f) => f.id === "question_3")?.value).toBe("4");
    expect(filled.find((f) => f.id === "question_4")?.value).toContain("35,000");
    expect(filled.find((f) => f.id === "question_9")).toMatchObject({ value: "", flagged: true });
    expect(filled.find((f) => f.id === "location")).toMatchObject({
      value: "תל אביב",
      flagReason: "location",
      transmit: false,
    });
  });

  it("builds a Greenhouse body without location, demographics, or file bytes in the snapshot", () => {
    const fields = mapProfile(parseGreenhouseForm(greenhouse), profile).map((f) =>
      f.id === "question_9"
        ? { ...f, value: "1", source: "user" as const, flagged: false, confidence: "high" as const }
        : f,
    );
    const body = greenhouseBody(fields, { resume: { filename: "cv.pdf", base64: "QQ==" } });
    expect(body.first_name).toBe("Dana");
    expect(body.question_9).toBe("1");
    expect(body.resume_content).toBe("QQ==");
    expect(body.resume_content_filename).toBe("cv.pdf");
    expect(body).not.toHaveProperty("location");
    expect(body).not.toHaveProperty("latitude");
    expect(JSON.stringify(body)).not.toContain("demographic");
    const snap = sentSnapshot({
      delivery: "handoff",
      platform: "greenhouse",
      reason: "greenhouse_no_key",
      fields,
      documents: [{ ref: "cv:1", title: "CV", fileName: "cv.pdf", type: "CV" }],
      recordedAt: "2026-11-05T00:00:00.000Z",
    });
    expect(JSON.stringify(snap)).not.toContain("QQ==");
    expect(snap.documents).toEqual([{ ref: "cv:1", title: "CV", fileName: "cv.pdf", type: "CV" }]);
  });

  it("attaches the CV to the resume field and blocks an API post while location is required", () => {
    const docs = [
      doc({ ref: "cv:1", type: "CV", title: "CV" }),
      doc({ ref: "doc:2", type: "COVER_LETTER", title: "Letter" }),
    ];
    const attached = attachDocuments(profilePacket(), ["cv:1", "doc:2"], docs);
    expect(attached.find((f) => f.id === "resume")?.value).toBe("cv:1");
    expect(attached.find((f) => f.id === "cover_letter")?.value).toBe("doc:2");
    const gh = mapProfile(parseGreenhouseForm(greenhouse), profile);
    expect(apiBlocked(gh)).toBe(true);
    expect(approveBlock(gh, false)).toBe("needs_input");
  });

  it("treats a posted value as the user's confirmation and rejects an option that is not on the question", () => {
    const field = blankField({
      id: "question_1",
      label: "Apples",
      kind: "select",
      required: true,
      options: [{ value: "1", label: "Yes" }],
    });
    expect(applyUserEdits([field], { question_1: "nope" })[0]).toMatchObject({
      value: "",
      flagReason: "unmatched_option",
    });
    expect(applyUserEdits([field], { question_1: "1" })[0]).toMatchObject({
      value: "1",
      source: "user",
      flagged: false,
    });
    expect(approveBlock(applyUserEdits([field], { question_1: "1" }), false)).toBeNull();
  });

  it("parses an Ashby form definition into field submissions", () => {
    const fields = parseAshbyForm({
      sections: [
        {
          fields: [
            { isRequired: true, field: { path: "_systemfield_name", title: "Name", type: "String" } },
            { isRequired: true, field: { path: "_systemfield_resume", title: "Resume", type: "File" } },
          ],
        },
      ],
    });
    expect(fields).toHaveLength(2);
    const named = mapProfile(fields!, { ...profile, name: "Dana Levi" });
    const withFile = named.map((f) => (f.kind === "file" ? { ...f, value: "cv:1" } : f));
    const built = ashbySubmission(withFile);
    expect(built.submissions).toContainEqual({ path: "_systemfield_name", value: "Dana Levi" });
    expect(built.files).toEqual([{ part: "file_1", fieldId: "_systemfield_resume" }]);
    expect(built.submissions).toContainEqual({ path: "_systemfield_resume", value: "file_1" });
    expect(leverPacket().map((f) => f.id)).toContain("urls.LinkedIn");
  });
});

describe("answers", () => {
  it("asks the model only for empty transmittable questions and flags the ones it cannot stand behind", () => {
    const visa = blankField({ id: "question_9", label: "Work authorization", sensitive: true, required: true });
    const open = blankField({ id: "question_3", label: "Why this team?", kind: "long" });
    expect(questionsForAi([visa, open]).map((f) => f.id)).toEqual(["question_3"]);
    const low = mergeAnswers(
      [open],
      { answers: [{ id: "question_3", value: "maybe", confidence: "low" }] },
      new Set(["question_3"]),
    );
    expect(low.fields[0]).toMatchObject({ flagged: true, flagReason: "low_confidence" });
    const high = mergeAnswers(
      [blankField({ id: "q", label: "Apples", kind: "select", options: [{ value: "1", label: "Yes" }] })],
      { answers: [{ id: "q", value: "Yes", confidence: "high" }] },
      new Set(["q"]),
    );
    expect(high.fields[0]).toMatchObject({ value: "1", flagged: false, source: "ai" });
    const skipped = mergeAnswers(
      [visa],
      { answers: [{ id: "question_9", value: "Yes", confidence: "high" }] },
      new Set(["question_9"]),
    );
    expect(skipped.fields[0].value).toBe("");
    expect(flagUnanswered([open], new Set(["question_3"]))[0]).toMatchObject({ value: "", flagged: true });
    expect(promptHasSecret(answerPrompt({ company: "Acme", title: "Eng", profile, questions: [open] }))).toBe(false);
    expect(promptHasSecret([{ role: "user", content: "AIzaSyA1234567890123456789012345678901234" }])).toBe(true);
  });
});

describe("queue", () => {
  it("keeps manual jobs out of the review list and approved packets out of both", () => {
    expect(queueBucket("MANUAL")).toBe("manual");
    expect(queueBucket("NEEDS_INPUT")).toBe("review");
    expect(queueBucket("HANDED_OFF")).toBe("done");
    const grouped = groupQueue([
      { id: "a", status: "READY" },
      { id: "b", status: "MANUAL" },
      { id: "c", status: "SUBMITTED" },
    ]);
    expect(grouped.review.map((r) => r.id)).toEqual(["a"]);
    expect(grouped.manual.map((r) => r.id)).toEqual(["b"]);
    expect(grouped.done.map((r) => r.id)).toEqual(["c"]);
  });
});

describe("submission HTTP", () => {
  it("posts Greenhouse once with Basic auth and keeps the key out of the URL", async () => {
    const calls: { url: string; auth: string }[] = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), auth: String(new Headers(init?.headers).get("authorization")) });
      return new Response("nope", { status: 500 });
    }) as typeof fetch;
    const result = await submitGreenhouse({
      board: "acme",
      jobId: "11",
      apiKey: "super-secret-key",
      body: { email: "a@b.c" },
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://boards-api.greenhouse.io/v1/boards/acme/jobs/11");
    expect(calls[0]!.url).not.toContain("super-secret-key");
    expect(calls[0]!.auth.startsWith("Basic ")).toBe(true);
    expect(calls[0]!.auth).not.toContain("super-secret-key");
  });

  it("posts Ashby multipart field submissions without putting the key in the URL", async () => {
    let auth = "";
    let jobPostingId = "";
    let form = "";
    const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      auth = String(new Headers(init?.headers).get("authorization"));
      const body = init?.body as FormData;
      jobPostingId = String(body.get("jobPostingId"));
      form = String(body.get("applicationForm"));
      return new Response(JSON.stringify({ success: true, results: { applicationId: "app-1" } }), { status: 200 });
    }) as typeof fetch;
    const result = await submitAshby({
      apiKey: "ashby-secret",
      jobPostingId: "26a4281b-4ab2-4829-b664-7c43d7dbd409",
      submissions: [{ path: "_systemfield_name", value: "Dana" }],
      files: [],
      fetchImpl,
    });
    expect(result).toEqual({ ok: true, id: "app-1" });
    expect(jobPostingId).toBe("26a4281b-4ab2-4829-b664-7c43d7dbd409");
    expect(form).toContain("_systemfield_name");
    expect(auth.startsWith("Basic ")).toBe(true);
    expect(auth).not.toContain("ashby-secret");
  });
});

describe("board keys", () => {
  it("ignores malformed payloads and never throws", () => {
    expect(parseBoardKeys("")).toEqual({ greenhouse: {}, ashby: {} });
    expect(parseBoardKeys("not-json")).toEqual({ greenhouse: {}, ashby: {} });
    expect(parseBoardKeys(JSON.stringify({ GREENHOUSE: { acme: "k" }, LEVER: { acme: "nope" } }))).toEqual({
      greenhouse: { acme: "k" },
      ashby: {},
    });
  });
});
