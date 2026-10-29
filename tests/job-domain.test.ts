import { describe, expect, it } from "vitest";
import { inferJobDomain } from "@/lib/jobs/domain-classifier";
import { DOMAIN_COLORS, DOMAIN_LABELS, JOB_DOMAINS, isJobDomain } from "@/lib/jobs/domains";
import { deriveJobFields } from "@/lib/jobs/classify";

const d = (title: string, extra: Omit<Parameters<typeof inferJobDomain>[0], "title"> = {}) =>
  inferJobDomain({ title, ...extra });

describe("inferJobDomain — titles", () => {
  it.each([
    // the brief's examples
    ["Senior DevOps Engineer", "devops"],
    ["Backend Developer (Go)", "backend"],
    ["מפתח/ת Full Stack", "fullstack"],
    ["Verification Engineer", "hardware"],
    ["Data Scientist", "data-science"],
    ["Security Researcher", "security"],
    ["Automation Engineer", "qa"],
    ["Solutions Architect", "support"],
    // more realistic Israeli-market titles
    ["Senior Frontend Engineer (React)", "frontend"],
    ["Android Developer", "mobile"],
    ["iOS Team Lead", "mobile"],
    ["Site Reliability Engineer", "devops"],
    ["Senior DevOps Engineer - Backend Infrastructure Team", "devops"],
    ["Platform Engineer", "devops"],
    ["Senior Cloud Network Engineer", "cloud"],
    ["Infrastructure Team Leader", "cloud"],
    ["Senior Data Engineer", "data-eng"],
    ["Big Data & Data Infrastructure Engineer", "data-eng"],
    ["ML Engineer, Computer Vision", "data-science"],
    ["Senior Algorithm Engineer - Model Training & Optimization", "data-science"],
    ["Senior AI STA Engineer, Sub-chip", "hardware"],
    ["Data Analyst", "analytics"],
    ["Senior Business Intelligence Analyst", "analytics"],
    ["QA Automation Engineer", "qa"],
    ["Senior QA Automation Engineer, ASIC Simulation", "qa"],
    ["Network Automation Engineer", "cloud"],
    ["Application Security Engineer", "security"],
    ["Senior Chip Design Verification Engineer", "hardware"],
    ["Senior Pre Silicon Reliability Engineer", "hardware"],
    ["Physical Design Engineer", "hardware"],
    ["Mechanical Engineer", "hardware"],
    ["Radar System Engineer", "hardware"],
    ["Senior Firmware Engineer", "embedded"],
    ["Embedded Linux OS Architect", "embedded"],
    ["IT Helpdesk", "it"],
    ["System Administrator", "it"],
    ["Senior Product Manager", "product"],
    ["Product Marketing Manager", "sales"],
    ["UX/UI Designer", "design"],
    ["Senior Technical Program Manager", "project"],
    ["מנהל/ת פרויקטים", "project"],
    ["Technical Support Engineer", "support"],
    ["Customer Success Manager", "support"],
    ["Pre-Sales Engineer", "support"],
    ["Domain Consultant (Pre Sales)", "support"],
    ["Account Executive", "sales"],
    ["Growth Marketing Manager", "sales"],
    ["Senior AI Engineer - Marketing AI Transformation", "data-science"],
    ["Financial Controller", "business-ops"],
    ["Senior HR Business Partner, Chip Design", "business-ops"],
    ["Talent Acquisition Specialist", "business-ops"],
    ["Senior Buyer", "business-ops"],
    ["Senior Developer Relations Manager", "sales"],
    // Hebrew titles
    ["בודק/ת תוכנה", "qa"],
    ["מהנדס/ת אוטומציה", "qa"],
    ["מנהל/ת מוצר", "product"],
    ["חוקר/ת סייבר", "security"],
    ["מהנדס/ת חומרה", "hardware"],
    ["מעצב/ת UX", "design"],
    ["נציג/ת מכירות", "sales"],
    ["נציג.ת תמיכת לקוחות", "support"],
    ["מחסנאי/ת", "business-ops"],
    ["איש/אשת סיסטם", "it"],
    ["מפתח/ת Backend", "backend"],
    // not a real role
    ["General Application (Israel)", "other"],
    ["Didn't find your dream position ?!", "other"],
    ["Clinical Trial Assistant", "other"],
  ])("%s → %s", (title, domain) => {
    expect(d(title)).toBe(domain);
  });
});

describe("inferJobDomain — generic titles use department, skills and description", () => {
  it("falls back to 'software' when nothing narrows it down", () => {
    expect(d("Senior Software Engineer")).toBe("software");
    expect(d("מפתח/ת תוכנה")).toBe("software");
  });

  it("uses the department", () => {
    expect(d("Senior Software Engineer", { department: "Mobile" })).toBe("mobile");
    expect(d("Software Engineer", { department: "R&D - Embedded SW" })).toBe("embedded");
    expect(d("Engineer", { department: "DevOps" })).toBe("devops");
  });

  it("does not read 'Research & Development' as research science", () => {
    expect(d("Senior Software Engineer (Go)", { department: "Research & Development" })).toBe("software");
  });

  it("uses extracted skills", () => {
    expect(d("Senior Software Engineer", { techStack: ["Java", "Spring", "Kafka", "PostgreSQL", "Redis"] })).toBe(
      "backend",
    );
    expect(d("Software Engineer", { techStack: ["React", "Redux", "TypeScript", "Next.js"] })).toBe("frontend");
    expect(
      d("Software Engineer", {
        techStack: ["React", "Angular", "Node.js", "PostgreSQL", "Redis", "TypeScript"],
        description: "You will build our web application end to end: React front-end and Node.js microservices.",
      }),
    ).toBe("fullstack");
  });

  it("uses the description when it is explicit", () => {
    expect(
      d("Software Engineer", {
        description: "Join our full stack team. As a full-stack engineer you will own features end to end.",
      }),
    ).toBe("fullstack");
    expect(
      d("Senior Software Engineer", {
        description: "Develop embedded firmware for our RTOS-based devices, write device drivers and low-level code.",
      }),
    ).toBe("embedded");
  });

  it("keeps the title ahead of a conflicting department", () => {
    expect(d("Senior Data Engineer", { department: "Backend" })).toBe("data-eng");
    expect(d("Product Designer", { department: "Engineering" })).toBe("design");
  });

  it("uses the department for business roles with vague titles", () => {
    expect(d("Team Lead", { department: "Customer Success" })).toBe("support");
    expect(d("Specialist", { department: "Marketing" })).toBe("sales");
  });
});

describe("domain metadata", () => {
  it("has a label in both languages and a colour for every domain", () => {
    for (const k of JOB_DOMAINS) {
      expect(DOMAIN_LABELS.en[k]).toBeTruthy();
      expect(DOMAIN_LABELS.he[k]).toBeTruthy();
      expect(DOMAIN_COLORS[k]).toMatch(/bg-/);
    }
    expect(isJobDomain("backend")).toBe(true);
    expect(isJobDomain("nope")).toBe(false);
  });

  it("is derived at ingest by deriveJobFields", () => {
    expect(deriveJobFields("Senior DevOps Engineer").domain).toBe("devops");
    expect(
      deriveJobFields("Software Engineer", {}, { department: "Mobile", techStack: [], description: "" }).domain,
    ).toBe("mobile");
  });
});

describe("inferJobDomain — hardware is not over-assigned", () => {
  it.each([
    // software / firmware work at chip companies
    ["Software Verification Engineer", "qa"],
    ["Software Verification Manager, SDK", "qa"],
    ["Network Solution Verification Engineer", "qa"],
    ["Senior Firmware PHY Verification Engineer", "embedded"],
    ["Senior Firmware Architect, Management Power and Thermal", "embedded"],
    ["Senior Software Engineer, Chip Design", "software"],
    ["Electron Optics Devices Software Engineer", "software"],
    // look-alike keywords
    ["Senior CAD/BIM Drafter & Modeler - Civil 3D", "design"],
    ["Director, Medical Excellence, Electrophysiology", "other"],
    ["HPC Operations Engineer", "cloud"],
    ["Manufacturing Supervisor", "business-ops"],
    ["טכנאי/ת מחשבים", "it"],
    ["טכנאי/ת תקשורת ותשתיות רשת", "it"],
    // ambiguous engineering titles with no hardware evidence
    ["Integration Engineer", "other"],
    ["Technical Product Engineer (Cortex)", "other"],
    ["Product Engineering - Future Opportunities", "other"],
  ])("%s → %s", (title, expected) => {
    expect(d(title)).toBe(expected);
  });

  it("keeps real hardware titles", () => {
    for (const t of [
      "Verification Engineer",
      "Senior Chip Design Engineer",
      "Physical Design Engineer",
      "Senior Signal Integrity Engineer",
      "Mechanical Engineer",
      "Radar System Engineer",
      "IC Product Engineer",
      "CAD/Emulation Engineer",
      "Electro Optics Systems Engineer",
      "Production Technician",
    ])
      expect(d(t), t).toBe("hardware");
  });

  it("needs hardware evidence for System / Integration / Product Engineer", () => {
    expect(d("System Engineer", { description: "Own the integration of RF boards and sensors into the radar." })).toBe(
      "hardware",
    );
    expect(d("Integration Engineer", { department: "Hardware" })).toBe("hardware");
    expect(
      d("Integration Engineer", { description: "Build REST API integrations with Salesforce and HubSpot." }),
    ).not.toBe("hardware");
    expect(d("Senior Product Engineer", { techStack: ["React", "TypeScript", "Node.js"] })).not.toBe("hardware");
  });
});
