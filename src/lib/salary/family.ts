import type { RoleCategory } from "@/lib/taxonomy";
import type { SalaryFamily, SalaryLevel } from "./reference";

export type AnySeniority = "INTERN" | SalaryLevel;

/** Map a job (stored roleCategory + title) to a salary family. Business roles are split out of "other". */
export function salaryFamily(roleCategory: RoleCategory | string, title: string): SalaryFamily {
  const t = title.toLowerCase();
  switch (roleCategory) {
    case "backend":
    case "frontend":
    case "fullstack":
    case "mobile":
    case "devops":
    case "data":
    case "ml":
    case "security":
    case "hardware":
    case "product":
    case "design":
      return roleCategory;
    case "qa":
      return /automation|sdet|in test|אוטומציה/.test(t) ? "qa_automation" : "qa";
    case "management":
      return "eng_management";
  }
  return businessFamily(t);
}

export function businessFamily(t: string): SalaryFamily {
  if (/\b(legal|counsel|paralegal|attorney|lawyer)\b|עו"ד|יועמ"ש|משפט/.test(t)) return "legal";
  if (
    /\b(finance|financial|fp&a|accountant|accounting|controller|payroll|treasury|tax|billing|cfo)\b|כספים|חשב|שכר/.test(
      t,
    )
  )
    return "finance";
  if (/\b(recruit\w*|talent|hr|human resources|people|hrbp)\b|גיוס|משאבי אנוש/.test(t)) return "people";
  if (
    /\b(sales|account executive|account manager|business development|bdr|sdr|pre-?sales|solutions? (engineer|architect|consultant)|partnerships?|revenue)\b|מכירות/.test(
      t,
    )
  )
    return "sales";
  if (/\b(marketing|content|brand|seo|growth|demand gen|communications|pr)\b|שיווק/.test(t)) return "marketing";
  if (/\b(customer|support|success|onboarding|implementation|technical account)\b|תמיכה|שירות לקוחות/.test(t))
    return "customer";
  if (
    /\b(operations?|procurement|office manager|project manager|program manager|supply|logistics|admin\w*)\b|תפעול/.test(
      t,
    )
  )
    return "operations";
  return "other";
}

/** Normalise stored seniority into a reference level plus an optional out-of-table factor. */
export function salaryLevel(
  seniority: AnySeniority | string,
  title: string,
): { level: SalaryLevel; extrapolated: "intern" | "executive" | null } {
  if (seniority === "INTERN") return { level: "JUNIOR", extrapolated: "intern" };
  if (seniority === "MANAGER") {
    const exec = /\b(director|vp|vice president|head of|chief|cto|ceo|cfo|coo|cmo)\b/i.test(title);
    return { level: "MANAGER", extrapolated: exec ? "executive" : null };
  }
  if (seniority === "JUNIOR" || seniority === "MID" || seniority === "SENIOR" || seniority === "LEAD")
    return { level: seniority, extrapolated: null };
  return { level: "MID", extrapolated: null };
}
