import { describe, expect, it } from "vitest";
import { deriveJobFields, inferEmploymentType, inferJobFunction, inferLevel } from "@/lib/jobs/classify";

describe("inferJobFunction", () => {
  it.each([
    ["Senior Backend Engineer", "engineering"],
    ["Full Stack Developer", "engineering"],
    ["Data Scientist", "data"],
    ["ML Engineer, Computer Vision", "data"],
    ["DevOps Engineer", "devops"],
    ["IT Systems Administrator", "devops"],
    ["Senior Release Manager", "devops"],
    ["QA Automation Engineer", "qa"],
    ["Security Researcher", "security"],
    ["Senior DevSecOps Manager", "security"],
    ["ASIC Verification Engineer", "hardware"],
    ["Product Manager", "product"],
    ["Product Designer", "design"],
    ["Account Executive", "sales"],
    ["Content Marketing Manager", "marketing"],
    ["Customer Success Manager", "customer"],
    ["Corporate Development Manager", "operations"],
    ["Senior Accountant", "finance"],
    ["Technical Recruiter", "people"],
    ["Legal Counsel", "legal"],
    ["General Application", "other"],
  ])("%s → %s", (title, fn) => {
    expect(inferJobFunction(title)).toBe(fn);
  });
  it("does not read PR&D as public relations", () => {
    expect(inferJobFunction("PR&D Software Engineer")).toBe("engineering");
  });
});

describe("inferLevel", () => {
  it.each([
    ["Software Engineering Intern", "INTERN"],
    ["Student Data Analyst", "INTERN"],
    ["Junior Frontend Developer", "ENTRY"],
    ["Backend Engineer", "MID"],
    ["Senior Backend Engineer", "SENIOR"],
    ["Sr. Data Engineer", "SENIOR"],
    ["Staff Engineer", "LEAD"],
    ["Principal Architect", "LEAD"],
    ["Team Lead, Platform", "LEAD"],
    ["Engineering Manager", "MANAGER"],
    ["Director of Engineering", "DIRECTOR"],
    ["Head of Data", "DIRECTOR"],
    ["VP R&D", "EXECUTIVE"],
    ["CTO", "EXECUTIVE"],
  ])("%s → %s", (title, level) => {
    expect(inferLevel(title)).toBe(level);
  });
  it("is not fooled by sales/assistant 'executive' or CTO-office roles", () => {
    expect(inferLevel("Account Executive")).not.toBe("EXECUTIVE");
    expect(inferLevel("Engineer, CTO Office")).not.toBe("EXECUTIVE");
  });
});

describe("inferEmploymentType", () => {
  it("defaults to full time", () => {
    expect(inferEmploymentType("Backend Engineer")).toBe("FULL_TIME");
  });
  it("reads ATS hints and title cues", () => {
    expect(inferEmploymentType("Engineer", "Part-time")).toBe("PART_TIME");
    expect(inferEmploymentType("Engineer", "Contract")).toBe("CONTRACT");
    expect(inferEmploymentType("Software Engineering Intern")).toBe("INTERNSHIP");
    expect(inferEmploymentType("HR Partner (Maternity Leave Cover)")).toBe("TEMPORARY");
    expect(inferEmploymentType("Freelance Designer")).toBe("CONTRACT");
  });
});

describe("deriveJobFields", () => {
  it("returns all derived fields together", () => {
    expect(deriveJobFields("Senior Data Engineer", { commitment: "Full-time" })).toEqual({
      jobFunction: "data",
      level: "SENIOR",
      employmentType: "FULL_TIME",
    });
  });
});

describe("ingestion sets derived fields", () => {
  it("buildJob classifies the title and keeps the ATS update time", async () => {
    const { buildJob } = await import("@/lib/ingestion/normalize");
    const job = buildJob({
      externalId: 1,
      source: "LEVER",
      title: "Senior Product Manager",
      locations: ["Tel Aviv"],
      descriptionHtmlOrText: "<p>Own the roadmap</p>",
      applyUrl: "https://example.com/apply",
      postedAt: "2026-10-01T00:00:00Z",
      commitmentHint: "Part-time",
      updatedAt: 1793000000000,
    });
    expect(job).toMatchObject({ jobFunction: "product", level: "SENIOR", employmentType: "PART_TIME" });
    expect(job?.sourceUpdatedAt).toEqual(new Date(1793000000000));
  });
});
