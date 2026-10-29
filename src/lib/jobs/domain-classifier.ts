import { inferJobFunction, type JobFunction } from "./classify";
import type { JobDomain } from "./domains";

/**
 * Deterministic job-domain classifier (no AI calls).
 *
 * Signals, strongest first:
 *  1. the title — an ordered rule list, first match wins (English + Hebrew titles);
 *  2. the ATS department (e.g. "Mobile", "Data", "IT & Security");
 *  3. for generic titles ("Senior Software Engineer", "מפתח/ת"), the extracted skills and the
 *     description decide between backend / frontend / full stack / mobile / embedded / data;
 *  4. finally the broad `jobFunction` from `inferJobFunction` (PR #8) for business roles.
 * Anything left over is "other".
 */
export interface DomainInput {
  title: string;
  department?: string | null;
  techStack?: readonly string[] | null;
  description?: string | null;
}

/** Only the head of a description is read: requirements sit near the top and it bounds the work. */
export const DOMAIN_DESCRIPTION_CHARS = 3000;

const norm = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/office of the (cto|ceo)|\b(cto|ceo)\s+(office|group|team|org|operations)\b/g, " ")
    .replace(/[–—_|]/g, " - ")
    .replace(/\s+/g, " ")} `;

const NOT_A_ROLE =
  /general application|open application|talent (network|pool|community)|didn'?t see|spontaneous|career (at|opportunit)|surprise us|no match\?|explore new opportunities|would love to join|didn'?t find|looking for something else|keep in touch|קורות חיים כללי|משרה כללית/;

type Rule = [JobDomain, RegExp, RegExp?, "needs-hardware-evidence"?];

/**
 * Titles that are software work even inside a chip / devices company ("ATE Software Engineer",
 * "Senior Software Engineer, Chip Design"): never routed to hardware by a title keyword.
 */
const SOFTWARE_OR_FIRMWARE_TITLE =
  /\bsoftware (engineer|developer|architect|team|tech lead|lead)|\bsw (engineer|developer|architect)\b|firmware|קושחה|תוכנה/;

/** Non-electronics "CAD" (construction / civil drafting) and similar look-alikes. */
const NOT_HARDWARE_CAD = /\bbim\b|civil|drafter|drafting|autocad|revit|architectural|construction/;

/**
 * Hardware evidence for ambiguous titles ("System Engineer", "Integration Engineer", "Product Engineer"):
 * those are hardware only when the department, skills or description say so.
 */
const HARDWARE_EVIDENCE =
  /hardware|\bhw\b|\bic\b|\basic\b|fpga|vlsi|silicon|semiconductor|wafer|\bchips?\b|chipset|\bpcb\b|\bboards?\b|electronic|electrical|electro[\s-]?(optic|mechan)|mechanical|optic|laser|\brf\b|antenna|radar|lidar|sensor|oscilloscope|solder|manufactur|assembly line|production line|wireless|satellite|avionic|aircraft|\buav\b|drone|missile|camera|medical device|equipment|test instruments|power supply|\bphy\b|serdes|signal integrity|thermal|matlab|simulink|cadence|labview|vhdl|verilog|systemverilog|\bdoors\b|mil-std|ניסויי|חומרה|אלקטרוני|מכני|שבב|ייצור/;

/** Business-facing roles that would otherwise be caught by tech keywords ("Product Marketing Manager", "Solutions Architect"). */
const BUSINESS_TITLE_RULES: Rule[] = [
  [
    "business-ops",
    /\bhr\b|hrbp|human resources|recruit|talent (acquisition|sourcing|partner)|\bsourcer\b|people (partner|operations|business)|compensation|payroll|controller|accountant|accounting|bookkeep|\bcfo\b|fp&a|financ\w* (manager|director|analyst|operations|controller|planning|lead)|\baudit|tax (manager|director|specialist)|treasur|legal|counsel|paralegal|office manager|executive assistant/,
    /\b(engineer|developer|scientist)\b/,
  ],
  [
    "design",
    /designer|\bux\b|\bui\s?\/\s?ux\b|ux\s?\/\s?ui|product design|design (lead|manager|director)|ux research|user research|ux writer|\bcreative director\b|art director|illustrat|motion (graphics|designer)|מעצב|עיצוב/,
  ],
  ["sales", /product marketing|\bpmm\b|developer (relations|advocate|marketing|evangelist)|\bdevrel\b/],
  [
    "business-ops",
    /procurement|purchasing|\bbuyer\b|sourcing (manager|specialist)|logistic|warehouse|supply chain|\bplanner\b|material (planner|manager)|import|export|shipper|chief operating officer|\bcoo\b|production (associate|employee|worker|operator)s?|\boperator\b|assembler|shift supervisor|(manufacturing|production) (supervisor|manager)|store manager|קניין|רכש|מחסנ|לוגיסטיק|מלקט|תפעול|מרכיב|יצור|ייצור|כרסם|חרט|מלחימ|משמרת|גיוס|משאבי אנוש|כספים|חשבונ|בנקאי/,
  ],
  ["analytics", /product analyst|product (data )?analytics|product insights/],
  [
    "product",
    /product (manager|owner|lead|director|management|specialist|executive|operations)|\bpm\b|\bgpm\b|(head|director|vp|chief) of products?|vp,? products?|\bcpo\b|מנהל.{0,4} מוצר|ניהול מוצר/,
  ],
  [
    "project",
    /program manag|project manag|programme manag|\btpm\b|\bepm\b|scrum master|agile coach|delivery manager|\bpmo\b|project (lead|coordinator|leader|engineer)|program (lead|coordinator)|release train|מנהל.{0,4} פרויקט|ניהול פרויקט|מנהל.{0,4} תוכני/,
  ],
  [
    "support",
    /solutions? (engineer|architect|consultant|expert|specialist|lead|manager)|sales engineer|pre[\s-]?sales|field application|\bfae\b|applications? engineer|customer (success|support|engineer|solutions|experience|care|service|acceptance)|technical support|tech support|\bsupport (engineer|specialist|analyst|lead|manager|team|tier|representative|rep)\b|tier \d|implementation (engineer|manager|specialist|consultant|lead)|professional services|technical account manager|\btam\b|onboarding (specialist|manager|engineer)|deploy(ment|ed) engineer|forward deployed|technical success|escalation engineer|תמיכ|שירות לקוחות/,
    /\bit support|support it\b/,
  ],
  [
    "sales",
    /\bsales\b(?! engineer)|account executive|account manager|business development|\bbdr\b|\bsdr\b|partnerships?\b|channel (manager|partner|sales)|\bmarketing\b|\bgrowth (manager|marketing|lead)|demand gen|\bseo\b|\bsem\b|\bppc\b|paid media|social media|content (writer|manager|marketing|strategist)|copywriter|\bbrand\b|public relations|communications manager|go-to-market|\bgtm\b|monetization|user acquisition|renewals|account director|מכירות|שיווק|פיתוח עסקי/,
    /\b(engineer|developer|scientist)\b/,
  ],
];

/** Technical domains. Ordered: the first match wins, so specific beats generic. */
const TECH_TITLE_RULES: Rule[] = [
  [
    "qa",
    // "Software Verification Engineer", "Network Solution Verification Manager": software testing, not silicon.
    /(software|\bsw|solutions?|system test|sdk|application|e2e|end[\s-]to[\s-]end) verification/,
  ],
  [
    "security",
    /security|cyber|appsec|penetration|pentest|red team|blue team|threat|malware|vulnerab|incident respon|\bsoc (analyst|manager|team|tier)|\bgrc\b|\bciso\b|secops|detection (engineer|research)|reverse engineer|\bdfir\b|forensic|fraud|סייבר|אבטחת מידע|אבטחה/,
  ],
  [
    "hardware",
    /design verification|\bdv\b|(chip|asic|soc|rtl|fpga|hardware|silicon|ip) (design )?verification|verification (engineer|lead|manager|team|architect)|post[\s-]?silicon|pre[\s-]?silicon|hardware (validation|test)|אימות (חומרה|שבבים)/,
    /firmware|קושחה/,
  ],
  [
    "qa",
    /\bqa\b|quality assurance|\bsdet\b|\bsdit\b|test (engineer|automation|lead|manager|architect|developer|infrastructure)|testing (engineer|lead)|automation (engineer|developer|lead|tech lead|team|architect|infrastructure|expert)|\btester\b|software test|(software|system|sw) validation|validation engineer|\bqa\s?\/\s?automation|בודק|בדיקות|\bqa\b|אוטומציה/,
    /network automation|marketing automation|process automation|\brpa\b|it automation|cloud automation|devops automation|lifecycle/,
  ],
  ["devops", /devops|dev ops|\bsre\b|site reliability|דבאופס/],
  ["fullstack", /full[\s-]?stack|פולסטאק|פול סטאק/],
  [
    "frontend",
    /front[\s-]?end|\bui (engineer|developer|team|lead)|web (developer|engineer)|(react|angular|vue)(\.js)? (developer|engineer)|client[\s-]side|(chrome|browser) extension|פרונט/,
  ],
  ["mobile", /android|\bios\b|mobile|react native|flutter|\bmacos\b|\bswift (developer|engineer)|מובייל|אנדרואיד/],
  [
    "backend",
    /back[\s-]?end|server[\s-]side|\bserver (developer|engineer)|\bapi (developer|engineer)|microservices|(java|golang|\bgo|python|node(\.?js)?|\.net|c#|ruby|scala|php|kotlin|rust)\s+(developer|engineer|team lead|tech lead|programmer)|באקאנד|בקאנד|צד שרת/,
  ],
  [
    "data-eng",
    /data (engineer|platform|infra\w*|pipelines?|architect|warehouse|ops|integration|lake)|big data|\betl\b|dataops|database|\bdba\b|analytics engineer|הנדסת נתונים|מהנדס.{0,4} (נתונים|דאטה)/,
  ],
  [
    "devops",
    /devops|dev ops|\bsre\b|site reliability|platform engineer|platform engineering|platform (team|group|lead)|release (engineer|manager)|build (engineer|infrastructure)|developer experience|\bdevex\b|ci\s?\/\s?cd|production (engineer|operations engineer)|reliability engineer|observability|kubernetes|דבאופס/,
  ],
  [
    "hardware",
    /\basic\b|fpga|vlsi|\bchip\b|sub-chip|silicon|physical design|\brtl\b|\bdft\b|\bsta\b|analog|serdes|\bsoc\b (architect|design)|emulation|logic design|synthesis|\bcad\b|\bate\b|package (design|integration)|thermal|opto|motion (control|&)|cable design|\bhw\b|failure analysis|sensor|device physics|power and performance|industrial engineer|\bv&v\b|חומרה|שבב/,
    new RegExp(`${SOFTWARE_OR_FIRMWARE_TITLE.source}|${NOT_HARDWARE_CAD.source}`),
  ],
  [
    "data-science",
    /data scien|machine learning|\bml\b|mlops|\bai\b|\bgen ?ai\b|artificial intelligence|deep learning|computer vision|\bnlp\b|\bllms?\b|algorithm|research scientist|applied (scientist|researcher|research)|\bresearcher\b|agentic|perception|language model|\bcv (engineer|researcher)|למידת מכונה|אלגוריתם|בינה מלאכותית/,
  ],
  [
    "analytics",
    /data analy|\banalyst\b|business intelligence|\bbi\b|analytics|insights|reporting|אנליסט|ניתוח נתונים|\bדאטה\b/,
    /financ|credit|risk|fp&a|investment|treasury|pricing|tax|payroll|legal|procurement|supply/,
  ],
  [
    "embedded",
    /embedded|firmware|\bbsp\b|\bbmc\b|kernel|device drivers?|\bdrivers? (developer|engineer)|\brtos\b|low[\s-]level|bare[\s-]metal|\bdsp\b (software|sw|engineer)|phy sw|קושחה|משובצ/,
  ],
  [
    "hardware",
    /hardware|\basic\b|fpga|vlsi|\bchip\b|silicon|physical design|\brtl\b|analog|digital design|electrical|electronic|electro[\s-]?(optic|mechan|magnetic)|board design|\bpcb\b|signal integrity|power (engineer|integrity|management|design)|\bdft\b|\bsta\b|layout (engineer|designer)|circuit|\brf\b|optic|photonic|mechanical|mechatronic|\bnpi\b|packaging|micro[\s-]?architect|\bcpu\b|\bgpu\b (architect|design)|\bsoc\b (architect|design)|חומרה|אלקטרוני|שבב|מכני|הנדסאי/,
    SOFTWARE_OR_FIRMWARE_TITLE,
  ],
  [
    "hardware",
    /manufacturing|\bic\b|physicist|lab (technician|engineer)|technician|טכנאי|magnetic|radar|\beo\b|wireless|rdma|interconnect|optics?\b/,
    /software|\bsw\b|\bit\b|cloud|network|security|azure|aws|gcp|computer|מחשב|תקשורת|רשת|supervisor/,
  ],
  [
    // Ambiguous engineering titles: hardware only with hardware evidence in department / skills / description.
    "hardware",
    /system(s)? (engineer|integrat\w*|architect|validation)|integration engineer|integrator|process engineer|product engineer|high-performance/,
    /software|\bsw\b|\bit\b|cloud|network|security|azure|aws|gcp/,
    "needs-hardware-evidence",
  ],
  [
    "it",
    /\bit\b|\bmis\b|help ?desk|sysadmin|system admin|systems admin|information systems|desktop support|endpoint|office 365|microsoft 365|workplace (technology|engineer)|מערכות מידע|מחשוב|איש סיסטם|אשת סיסטם|טכנאי.{0,6}(ציוד )?(מחשב|תקשורת)|computer technician/,
  ],
  [
    "cloud",
    /cloud|infrastructure|\binfra\b|network (engineer|architect|admin\w*|operations)|networking|network automation|\bnoc\b|storage|virtualization|linux (admin\w*|engineer)|data ?cent(er|re)|\bhpc\b|תשתיות|רשתות|ענן/,
    /compliance|reconciliation|finops|business partner/,
  ],
];

/** "Software Engineer", "R&D Team Lead", "מפתח/ת": engineering whose specialty must come from elsewhere. */
const GENERIC_SOFTWARE =
  /software|\bsw\b|developer(?! (relations|advocate|marketing|evangelist|support|experience))(?!s? \(?devex)|programmer|(manager|director|head|vp|lead)\b[^a-z]{0,4}(\w+[^a-z]{1,3})?engineering\b|\bcoder\b|compiler|\bunity\b|engineering team|squad lead|member of technical staff|r&d|r & d|engineering (manager|lead|director)|(director|head|vp),? (of )?(engineering|r&d|software)|\bcto\b|מפתח|מתכנת|פיתוח|תוכנה|ראש צוות פיתוח/;
/** Titles that are probably engineering but not necessarily software ("System Engineer", "Tech Lead"). */
const GENERIC_ENGINEER = /engineer|\beng\b|architect|tech lead|technical lead|מהנדס/;

/** Department names (ATS "team" / "department" fields): coarser than titles, so only clear cues. */
const DEPARTMENT_RULES: Rule[] = [
  ["security", /security|cyber|ciso|threat|\bmdr\b|אבטחת מידע|סייבר/, /it & security operations/],
  ["qa", /\bqa\b|quality assurance|\btest|automation/],
  ["mobile", /mobile|android|\bios\b/],
  ["frontend", /front[\s-]?end|\bweb\b|\bui\b/],
  ["fullstack", /full[\s-]?stack/],
  ["backend", /back[\s-]?end|server/],
  ["data-eng", /data (engineering|platform|infra\w*)|big data/],
  ["data-science", /\bai\b|\bml\b|machine learning|algo|data science/],
  ["analytics", /\bbi\b|analytics|business intelligence/],
  ["devops", /devops|\bsre\b|platform|production engineering|reliability/],
  ["embedded", /embedded|firmware|\bbsp\b/],
  ["hardware", /hardware|asic|chip|silicon|vlsi|fpga|electronic|mechanic|\bhw\b/],
  ["it", /\bit\b|\bmis\b|information systems|help ?desk|מערכות מידע/],
  ["cloud", /infrastructure|\binfra\b|cloud|network/],
  ["design", /design|\bux\b/],
  ["product", /\bproduct\b/],
  ["support", /support|customer success|customer experience|professional services|solutions|services/],
  ["sales", /sales|marketing|business development|growth|partnerships?|revenue|\bgtm\b/],
  [
    "business-ops",
    /finance|accounting|\bhr\b|people|talent|recruit|legal|g&a|operations|supply chain|procurement|purchasing|logistics|admin|treasury|risk|compliance|facilities|shared service/,
  ],
];

const FUNCTION_TO_DOMAIN: Record<JobFunction, JobDomain | null> = {
  engineering: null, // handled by the generic-software path
  data: "data-science",
  devops: "devops",
  qa: "qa",
  security: "security",
  hardware: "hardware",
  product: "product",
  design: "design",
  sales: "sales",
  marketing: "sales",
  customer: "support",
  operations: "business-ops",
  finance: "business-ops",
  people: "business-ops",
  legal: "business-ops",
  other: null,
};

function firstMatch(rules: Rule[], text: string, evidence = ""): JobDomain | null {
  for (const [domain, re, unless, needs] of rules) {
    if (!re.test(text) || (unless && unless.test(text))) continue;
    if (needs === "needs-hardware-evidence" && !HARDWARE_EVIDENCE.test(evidence)) continue;
    return domain;
  }
  return null;
}

/** Skill / description cues for the software specialties. Each hit adds weight to its domain. */
const SKILL_WEIGHTS: Partial<Record<JobDomain, string[]>> = {
  frontend: ["React", "Angular", "Vue", "Next.js", "Redux", "Tailwind", "JavaScript", "TypeScript"],
  backend: [
    "Java",
    "Spring",
    "Go",
    "Node.js",
    "NestJS",
    "Python",
    "Django",
    "FastAPI",
    ".NET",
    "C#",
    "Ruby",
    "PHP",
    "Scala",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "Kafka",
    "RabbitMQ",
    "gRPC",
    "GraphQL",
    "Elasticsearch",
    "Cassandra",
    "DynamoDB",
  ],
  mobile: ["Kotlin", "Swift", "React Native", "Flutter"],
  embedded: ["RTOS", "C++"],
  "data-eng": ["Spark", "Airflow", "Snowflake", "BigQuery", "Databricks", "dbt", "ClickHouse"],
  "data-science": ["PyTorch", "TensorFlow", "LLM", "LangChain", "scikit-learn", "OpenCV", "CUDA", "Pandas"],
  devops: ["Kubernetes", "Terraform", "Helm", "Ansible", "Jenkins", "Prometheus", "Grafana"],
};

const DESCRIPTION_CUES: [JobDomain, RegExp][] = [
  ["fullstack", /full[\s-]?stack/g],
  ["frontend", /front[\s-]?end|client[\s-]side|\bui\b|\bcss\b|web application/g],
  ["backend", /back[\s-]?end|server[\s-]side|microservices?|distributed systems|\bapis?\b|scalable services/g],
  ["mobile", /\bandroid\b|\bios\b|mobile app/g],
  ["embedded", /embedded|firmware|\brtos\b|linux kernel|device drivers?|bare[\s-]metal|low[\s-]level/g],
  ["data-eng", /data pipelines?|\betl\b|data lake|data warehouse|streaming data/g],
  ["data-science", /machine learning|deep learning|\bllms?\b|computer vision|\bnlp\b|model training/g],
  ["devops", /ci\s?\/\s?cd|infrastructure as code|kubernetes|observability/g],
];

const SOFTWARE_SPECIALTIES: JobDomain[] = [
  "fullstack",
  "frontend",
  "backend",
  "mobile",
  "embedded",
  "data-eng",
  "data-science",
  "devops",
];

/** Pick a software specialty from skills + description, or null when the evidence is weak or mixed. */
function softwareSpecialty(techStack: readonly string[], description: string): JobDomain | null {
  const score = new Map<JobDomain, number>();
  const add = (d: JobDomain, w: number) => score.set(d, (score.get(d) ?? 0) + w);
  const skills = new Set(techStack);
  for (const [d, list] of Object.entries(SKILL_WEIGHTS) as [JobDomain, string[]][])
    for (const s of list) if (skills.has(s)) add(d, d === "frontend" && /script$/i.test(s) ? 0.5 : 1);
  const text = description.toLowerCase();
  for (const [d, re] of DESCRIPTION_CUES) {
    const hits = text.match(re)?.length ?? 0;
    if (hits) add(d, Math.min(hits, 4) * (d === "fullstack" ? 2 : 1));
  }
  const fe = score.get("frontend") ?? 0;
  const be = score.get("backend") ?? 0;
  // A real mix of client and server work (or an explicit "full stack") is full stack.
  if ((score.get("fullstack") ?? 0) >= 2 || (fe >= 3 && be >= 3 && Math.min(fe, be) / Math.max(fe, be) >= 0.5))
    return "fullstack";
  score.delete("fullstack");
  const ranked = SOFTWARE_SPECIALTIES.map((d) => [d, score.get(d) ?? 0] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [[best, top], second] = [ranked[0], ranked[1]];
  if (top < 2.5) return null;
  if (second && top < second[1] * 1.5) return null;
  return best;
}

export function inferJobDomain(input: DomainInput): JobDomain {
  const t = norm(input.title);
  if (NOT_A_ROLE.test(t)) return "other";
  const dept = input.department ? norm(input.department) : "";
  const techStack = input.techStack ?? [];
  const description = (input.description ?? "").slice(0, DOMAIN_DESCRIPTION_CHARS);

  const strongSoftware = GENERIC_SOFTWARE.test(t);
  // 1. Title. Business-facing rules first, unless the title is clearly a software role.
  const business = firstMatch(BUSINESS_TITLE_RULES, t);
  if (business && !(strongSoftware && (business === "sales" || business === "support"))) return business;
  const evidence = `${t} ${dept} ${techStack.join(" ")} ${description}`.toLowerCase();
  const tech = firstMatch(TECH_TITLE_RULES, t, evidence);
  if (tech) return tech;
  if (business) return business;

  // 2-3. Generic engineering titles: department, then skills/description.
  const genericEngineer = !strongSoftware && GENERIC_ENGINEER.test(t);
  if (strongSoftware || genericEngineer) {
    const byDept = dept ? firstMatch(DEPARTMENT_RULES, dept) : null;
    if (byDept && !["design", "product", "support", "sales", "business-ops"].includes(byDept)) return byDept;
    const bySkills = softwareSpecialty(techStack, description);
    if (bySkills) return bySkills;
    if (strongSoftware) return "software";
  }

  // 4. Business roles via the broad job function, then the department.
  const fn = FUNCTION_TO_DOMAIN[inferJobFunction(input.title)];
  if (fn) return fn === "data-science" && /\banalyst\b/.test(t) ? "analytics" : fn;
  const byDept = dept ? firstMatch(DEPARTMENT_RULES, dept) : null;
  if (byDept && !genericEngineer) return byDept;
  if (genericEngineer && byDept && byDept !== "business-ops") return byDept;
  return "other";
}
