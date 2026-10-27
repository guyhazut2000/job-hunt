import { describe, expect, it } from "vitest";
import { extractTech, htmlToText, inferRoleCategory, inferSeniority, inferWorkMode, slugify } from "@/lib/taxonomy";

describe("taxonomy", () => {
  it("extracts canonical tech labels, including symbols", () => {
    expect(extractTech("We use Node.js, TypeScript, C++ and k8s on AWS")).toEqual([
      "AWS",
      "C++",
      "Kubernetes",
      "Node.js",
      "TypeScript",
    ]);
  });
  it("does not treat the English word 'go' as Golang", () => {
    expect(extractTech("Ready to go the extra mile")).not.toContain("Go");
    expect(extractTech("Backend in Golang")).toContain("Go");
  });
  it("infers seniority from titles (English and Hebrew)", () => {
    expect(inferSeniority("Senior Backend Engineer")).toBe("SENIOR");
    expect(inferSeniority("Team Lead, Backend")).toBe("LEAD");
    expect(inferSeniority("Software Engineering Student")).toBe("INTERN");
    expect(inferSeniority("מפתח/ת ג'וניור")).toBe("JUNIOR");
    expect(inferSeniority("Backend Engineer")).toBe("MID");
  });
  it("infers role categories", () => {
    expect(inferRoleCategory("Full Stack Developer")).toBe("fullstack");
    expect(inferRoleCategory("DevOps Engineer")).toBe("devops");
    expect(inferRoleCategory("Machine Learning Engineer")).toBe("ml");
    expect(inferRoleCategory("QA Automation Engineer")).toBe("qa");
  });
  it("infers work mode", () => {
    expect(inferWorkMode("Tel Aviv (Hybrid)")).toBe("HYBRID");
    expect(inferWorkMode("Remote - Israel")).toBe("REMOTE");
    expect(inferWorkMode("Haifa")).toBe("ONSITE");
  });
  it("strips html", () => {
    expect(htmlToText("&lt;p&gt;Hello &amp;amp; <b>world</b>&lt;/p&gt;")).toBe("Hello & world");
  });
  it("slugifies", () => {
    expect(slugify("Cloud Nest Ltd.")).toBe("cloud-nest-ltd");
  });
  it("handles real-world titles from Israeli boards", () => {
    expect(inferSeniority("Senior Product Manager")).toBe("SENIOR");
    expect(inferSeniority("Product Manager")).toBe("MID");
    expect(inferSeniority("Engineering Manager")).toBe("MANAGER");
    expect(inferSeniority("Backend Team Leader")).toBe("LEAD");
    expect(inferSeniority("Staff Engineer - Office of the CTO")).toBe("LEAD");
    expect(inferRoleCategory("Sales Engineer")).toBe("other");
    expect(inferRoleCategory("Account Executive")).toBe("other");
    expect(inferRoleCategory("Rapid Prototyping Engineer")).toBe("backend");
    expect(inferRoleCategory("API Engineer")).toBe("backend");
    expect(inferRoleCategory("FPGA Design Engineer")).toBe("hardware");
    expect(inferRoleCategory("Product Designer")).toBe("design");
    expect(inferRoleCategory("Director of Product, Growth")).toBe("product");
    expect(inferRoleCategory("Malware Researcher")).toBe("security");
    expect(inferRoleCategory("R&D Team Leader")).toBe("backend");
  });

  it("decodes numeric HTML entities", () => {
    expect(htmlToText("it&#39;s &#x2014; ok")).toBe("it's \u2014 ok");
  });
});
