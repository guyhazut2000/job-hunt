/**
 * Outbound-only links for checking salaries elsewhere (#91). We never fetch, scrape or display data
 * from these sites (ToS) — the UI labels each one "מקור חיצוני · לא מאומת".
 */
export const SALARY_EXTERNAL_LINKS = [
  { id: "glassdoor", name: "Glassdoor — Salaries", url: "https://www.glassdoor.com/Salaries/index.htm" },
  { id: "linkedin", name: "LinkedIn Salary", url: "https://www.linkedin.com/salary/" },
  { id: "levels", name: "Levels.fyi — Israel", url: "https://www.levels.fyi/locations/israel" },
] as const;
