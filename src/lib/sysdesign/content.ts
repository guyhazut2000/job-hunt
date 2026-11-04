/**
 * System design + AI-native prep (#118). All text is original to this product; external pages
 * are cited and linked only (roadmap.sh is link-only). Technical terms stay in English, as used
 * in Israeli hi-tech.
 */
import type { L } from "@/lib/algo/types";

export interface SdSource {
  id: string;
  title: string;
  by: string;
  url: string;
}

export const SD_SOURCES: SdSource[] = [
  {
    id: "primer",
    title: "The System Design Primer",
    by: "Donne Martin (GitHub)",
    url: "https://github.com/donnemartin/system-design-primer",
  },
  {
    id: "ddia",
    title: "Designing Data-Intensive Applications",
    by: "Martin Kleppmann",
    url: "https://dataintensive.net/",
  },
  {
    id: "delivery",
    title: "System Design in a Hurry: Delivery framework",
    by: "Hello Interview",
    url: "https://www.hellointerview.com/learn/system-design/in-a-hurry/delivery",
  },
  {
    id: "radio",
    title: "Front End System Design Playbook: RADIO framework",
    by: "GreatFrontEnd",
    url: "https://www.greatfrontend.com/front-end-system-design-playbook/framework",
  },
  { id: "roadmapSd", title: "System Design roadmap", by: "roadmap.sh", url: "https://roadmap.sh/system-design" },
  { id: "roadmapAi", title: "AI Engineer roadmap", by: "roadmap.sh", url: "https://roadmap.sh/ai-engineer" },
  {
    id: "latency",
    title: "Latency numbers every programmer should know (interactive)",
    by: "Colin Scott, after Jeff Dean",
    url: "https://colin-scott.github.io/personal_website/research/interactive_latency.html",
  },
  { id: "vitals", title: "Web Vitals", by: "web.dev (Google)", url: "https://web.dev/articles/vitals" },
  {
    id: "httpCache",
    title: "HTTP caching",
    by: "MDN Web Docs",
    url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching",
  },
  {
    id: "rag",
    title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
    by: "Lewis et al., 2020 (arXiv)",
    url: "https://arxiv.org/abs/2005.11401",
  },
  {
    id: "gemini",
    title: "Prompt design strategies",
    by: "Google AI for Developers",
    url: "https://ai.google.dev/gemini-api/docs/prompting-strategies",
  },
  {
    id: "openai",
    title: "Prompt engineering guide",
    by: "OpenAI",
    url: "https://platform.openai.com/docs/guides/prompt-engineering",
  },
  {
    id: "anthropic",
    title: "Prompt engineering overview",
    by: "Anthropic",
    url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview",
  },
  {
    id: "agents",
    title: "Building effective agents",
    by: "Anthropic Engineering",
    url: "https://www.anthropic.com/engineering/building-effective-agents",
  },
  { id: "evals", title: "Your AI Product Needs Evals", by: "Hamel Husain", url: "https://hamel.dev/blog/posts/evals/" },
  {
    id: "owasp",
    title: "OWASP Top 10 for LLM Applications 2025",
    by: "OWASP GenAI Security Project",
    url: "https://genai.owasp.org/llm-top-10/",
  },
  {
    id: "nist",
    title: "AI Risk Management Framework",
    by: "NIST",
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
  },
];
export const sdSource = (id: string) => SD_SOURCES.find((s) => s.id === id);

// ── The method ────────────────────────────────────────────────────────────────

export interface SdStep {
  id: string;
  minutes: number;
  title: L;
  goal: L;
  checklist: L[];
  sources: string[];
}

/** A 45-minute round. Timings are a suggested budget, not a rule. */
export const SD_METHOD: SdStep[] = [
  {
    id: "requirements",
    minutes: 5,
    title: { he: "דרישות והיקף", en: "Requirements and scope" },
    goal: {
      he: "להסכים מה בונים לפני שמציירים קופסה אחת.",
      en: "Agree on what you are building before you draw a single box.",
    },
    checklist: [
      { he: "3–5 דרישות פונקציונליות: מה המשתמש עושה.", en: "3–5 functional requirements: what the user does." },
      {
        he: "דרישות לא־פונקציונליות: latency, availability מול consistency, קנה מידה, פרטיות.",
        en: "Non-functional: latency, availability vs consistency, scale, privacy.",
      },
      { he: "לומר במפורש מה מחוץ להיקף.", en: "Say explicitly what is out of scope." },
    ],
    sources: ["delivery", "primer"],
  },
  {
    id: "estimates",
    minutes: 3,
    title: { he: "הערכות גסות", en: "Back-of-the-envelope estimates" },
    goal: {
      he: "רק מה שמשנה החלטה: QPS לקריאה ולכתיבה, נפח אחסון, גודל תשובה.",
      en: "Only what changes a decision: read and write QPS, storage, payload size.",
    },
    checklist: [
      {
        he: "יחס קריאה/כתיבה קובע אם cache ו־read replicas הם בסיס התכנון.",
        en: "The read/write ratio tells you whether cache and read replicas are central.",
      },
      {
        he: "לעגל באגרסיביות ולהגיד את ההנחות בקול.",
        en: "Round aggressively and say your assumptions out loud.",
      },
    ],
    sources: ["primer", "latency"],
  },
  {
    id: "api",
    minutes: 5,
    title: { he: "API ומודל נתונים", en: "API and data model" },
    goal: {
      he: "הישויות המרכזיות וה־endpoints (או אירועים) שמחברים ביניהן.",
      en: "The core entities and the endpoints (or events) that connect them.",
    },
    checklist: [
      { he: "REST/GraphQL/WebSocket: לבחור ולנמק.", en: "REST, GraphQL or WebSocket: pick one and say why." },
      { he: "pagination מבוסס cursor לרשימות ארוכות.", en: "Cursor-based pagination for long lists." },
      { he: "לכל ישות: מפתח, שדות עיקריים, אינדקסים.", en: "Per entity: key, main fields, indexes." },
    ],
    sources: ["delivery", "ddia"],
  },
  {
    id: "high-level",
    minutes: 10,
    title: { he: "תכנון ברמה גבוהה", en: "High-level design" },
    goal: {
      he: "תרשים שעונה על כל דרישה פונקציונלית מקצה לקצה, בפשטות.",
      en: "A diagram that serves every functional requirement end to end, simply.",
    },
    checklist: [
      { he: "לעבור על הזרימה של כל דרישה בתרשים.", en: "Walk each requirement's flow through the diagram." },
      {
        he: "להתחיל פשוט; לסבך רק כשדרישה מחייבת.",
        en: "Start simple; add complexity only when a requirement forces it.",
      },
    ],
    sources: ["delivery"],
  },
  {
    id: "deep-dives",
    minutes: 15,
    title: { he: "צלילות לעומק", en: "Deep dives" },
    goal: {
      he: "2–3 נקודות שבהן הדרישות הלא־פונקציונליות נשברות, ומה עושים איתן.",
      en: "2–3 places where the non-functional requirements break, and what you do about it.",
    },
    checklist: [
      { he: "צוואר בקבוק: hot keys, fan-out, כתיבות כבדות.", en: "Bottlenecks: hot keys, fan-out, heavy writes." },
      { he: "כשלים: retries, idempotency, timeouts.", en: "Failure: retries, idempotency, timeouts." },
      {
        he: "בכיר: להוביל את הבחירה בעצמך, לא לחכות שהמראיין ישאל.",
        en: "Senior: lead the choice of what to dive into; don't wait to be asked.",
      },
    ],
    sources: ["delivery", "ddia"],
  },
  {
    id: "tradeoffs",
    minutes: 5,
    title: { he: "פשרות (Trade-offs)", en: "Trade-offs" },
    goal: {
      he: "לכל החלטה: מה הרווחנו, על מה ויתרנו, ומתי היינו בוחרים אחרת.",
      en: "For each decision: what we gained, what we gave up, and when we would choose differently.",
    },
    checklist: [
      { he: "consistency מול availability, latency מול עלות.", en: "Consistency vs availability, latency vs cost." },
      { he: "build מול buy (שירות מנוהל).", en: "Build vs buy (a managed service)." },
    ],
    sources: ["ddia", "primer"],
  },
  {
    id: "wrap-up",
    minutes: 2,
    title: { he: "סיכום", en: "Wrap-up" },
    goal: {
      he: "דקה של סיכום: מה בנינו, איך מנטרים, ומה הצעד הבא בקנה מידה גדול יותר.",
      en: "A one-minute recap: what we built, how we monitor it, and the next step at larger scale.",
    },
    checklist: [
      { he: "מטריקות ו־SLO: מה יעיר אותנו בלילה.", en: "Metrics and SLOs: what would page us at night." },
      { he: "מה הייתי משנה עם עוד זמן.", en: "What I would change with more time." },
    ],
    sources: ["delivery"],
  },
];

/** Frontend rounds: the same idea, with client concerns in front (after GreatFrontEnd's RADIO). */
export const SD_FRONTEND_STEPS: { id: string; title: L; body: L }[] = [
  {
    id: "r",
    title: { he: "דרישות (Requirements)", en: "Requirements" },
    body: {
      he: "מכשירים, offline, נגישות, i18n/RTL, קנה מידה של הנתונים על המסך.",
      en: "Devices, offline, accessibility, i18n/RTL, how much data is on screen.",
    },
  },
  {
    id: "a",
    title: { he: "ארכיטקטורה (Architecture)", en: "Architecture" },
    body: {
      he: "רכיבים, איפה נמצא ה־state (שרת, client store, URL), SSR/CSR/SSG.",
      en: "Components, where state lives (server, client store, URL), SSR/CSR/SSG.",
    },
  },
  {
    id: "d",
    title: { he: "מודל נתונים (Data model)", en: "Data model" },
    body: {
      he: "הצורה של הנתונים ב־client, normalization, cache של שאילתות.",
      en: "Client-side data shape, normalization, query cache.",
    },
  },
  {
    id: "i",
    title: { he: "ממשק (Interface / API)", en: "Interface (API)" },
    body: {
      he: "חוזה בין client לשרת ובין רכיבים: props, events, pagination, שגיאות.",
      en: "Contracts between client and server and between components: props, events, pagination, errors.",
    },
  },
  {
    id: "o",
    title: { he: "אופטימיזציות (Optimizations)", en: "Optimizations" },
    body: {
      he: "ביצועים (Core Web Vitals), virtualization, optimistic UI, נגישות, אבטחה (XSS, CSP).",
      en: "Performance (Core Web Vitals), virtualization, optimistic UI, accessibility, security (XSS, CSP).",
    },
  },
];

// ── Cheat sheet ───────────────────────────────────────────────────────────────

export interface SdConcept {
  term: string;
  note: L;
}
export interface SdConceptGroup {
  id: string;
  title: L;
  items: SdConcept[];
  sources: string[];
}

export const SD_CHEATSHEET: SdConceptGroup[] = [
  {
    id: "scale",
    title: { he: "קנה מידה", en: "Scaling" },
    sources: ["primer"],
    items: [
      {
        term: "Horizontal vs vertical",
        note: {
          he: "עוד מכונות מול מכונה חזקה יותר; אופקי דורש שרתים stateless.",
          en: "More machines vs a bigger one; horizontal needs stateless servers.",
        },
      },
      {
        term: "Load balancer",
        note: {
          he: "מפזר בקשות, בודק health, מאפשר deploy בלי downtime.",
          en: "Spreads requests, health-checks, enables zero-downtime deploys.",
        },
      },
      {
        term: "CDN",
        note: {
          he: "תוכן סטטי (ולפעמים דינמי) קרוב למשתמש.",
          en: "Static (sometimes dynamic) content close to the user.",
        },
      },
    ],
  },
  {
    id: "data",
    title: { he: "נתונים", en: "Data" },
    sources: ["ddia"],
    items: [
      {
        term: "SQL vs NoSQL",
        note: {
          he: "יחסים ו־transactions מול סכמה גמישה וקנה מידה אופקי פשוט; לבחור לפי דפוס הגישה.",
          en: "Relations and transactions vs flexible schema and simple horizontal scale; choose by access pattern.",
        },
      },
      {
        term: "Index",
        note: {
          he: "קריאה מהירה במחיר כתיבה ואחסון; לאנדקס לפי השאילתות בפועל.",
          en: "Fast reads at the cost of writes and storage; index for the queries you actually run.",
        },
      },
      {
        term: "Replication",
        note: {
          he: "leader/follower לקריאות ולזמינות; replication lag = קריאות לא עדכניות.",
          en: "Leader/follower for reads and availability; replication lag means stale reads.",
        },
      },
      {
        term: "Sharding / partitioning",
        note: {
          he: "פיצול לפי מפתח; מפתח גרוע יוצר hot partition.",
          en: "Split by key; a bad key creates a hot partition.",
        },
      },
      {
        term: "CAP / consistency",
        note: {
          he: "בזמן network partition בוחרים בין consistency ל־availability; בשגרה זה trade-off בין latency ל־consistency.",
          en: "During a network partition you choose consistency or availability; normally it is latency vs consistency.",
        },
      },
    ],
  },
  {
    id: "cache",
    title: { he: "מטמון (Caching)", en: "Caching" },
    sources: ["primer", "httpCache"],
    items: [
      {
        term: "Cache-aside",
        note: {
          he: "האפליקציה קוראת מה־cache, ובהחטאה טוענת מה־DB וכותבת ל־cache.",
          en: "The app reads the cache and, on a miss, loads from the DB and fills the cache.",
        },
      },
      {
        term: "Invalidation / TTL",
        note: {
          he: "החלק הקשה; TTL קצר + מחיקה בכתיבה הוא ברירת מחדל סבירה.",
          en: "The hard part; a short TTL plus delete-on-write is a sane default.",
        },
      },
      {
        term: "HTTP caching",
        note: {
          he: "Cache-Control, ETag ו־stale-while-revalidate בדפדפן וב־CDN.",
          en: "Cache-Control, ETag and stale-while-revalidate in the browser and CDN.",
        },
      },
    ],
  },
  {
    id: "async",
    title: { he: "אסינכרוני ואמינות", en: "Async and reliability" },
    sources: ["ddia", "primer"],
    items: [
      {
        term: "Queue / pub-sub",
        note: {
          he: "מנתק בין יצרן לצרכן, סופג עומסים; at-least-once מחייב צרכן idempotent.",
          en: "Decouples producer and consumer, absorbs spikes; at-least-once needs an idempotent consumer.",
        },
      },
      {
        term: "Idempotency key",
        note: {
          he: "אותה בקשה פעמיים = תוצאה אחת (תשלומים, הזמנות).",
          en: "The same request twice gives one result (payments, orders).",
        },
      },
      {
        term: "Retries + backoff",
        note: {
          he: "exponential backoff עם jitter, ותמיד timeout.",
          en: "Exponential backoff with jitter, and always a timeout.",
        },
      },
      {
        term: "Rate limiting",
        note: {
          he: "token bucket או sliding window, לפי משתמש או מפתח API.",
          en: "Token bucket or sliding window, per user or API key.",
        },
      },
      {
        term: "Observability",
        note: {
          he: "logs, metrics, traces; SLO שמנוסח מנקודת המבט של המשתמש.",
          en: "Logs, metrics, traces; an SLO phrased from the user's point of view.",
        },
      },
    ],
  },
  {
    id: "frontend",
    title: { he: "צד לקוח (Frontend)", en: "Frontend" },
    sources: ["vitals", "radio"],
    items: [
      {
        term: "SSR / CSR / SSG / ISR",
        note: {
          he: "איפה ומתי נבנה ה־HTML; משפיע על LCP, SEO ועלות שרת.",
          en: "Where and when HTML is built; affects LCP, SEO and server cost.",
        },
      },
      {
        term: "Core Web Vitals",
        note: {
          he: "LCP, INP, CLS: הטעינה, התגובה והיציבות שהמשתמש מרגיש.",
          en: "LCP, INP, CLS: the loading, responsiveness and stability users feel.",
        },
      },
      {
        term: "Real-time",
        note: {
          he: "polling מול SSE מול WebSocket: לפי כיוון התעבורה ותדירותה.",
          en: "Polling vs SSE vs WebSocket: by direction and frequency of updates.",
        },
      },
      {
        term: "Virtualization",
        note: { he: "לרנדר רק את השורות שעל המסך ברשימות ארוכות.", en: "Render only on-screen rows in long lists." },
      },
      {
        term: "Optimistic UI",
        note: {
          he: "לעדכן מייד ולגלגל אחורה בשגיאה; מתאים לפעולות שכמעט תמיד מצליחות.",
          en: "Update immediately, roll back on error; for actions that almost always succeed.",
        },
      },
    ],
  },
];

/** Orders of magnitude only (see the latency source for the full, dated table). */
export const SD_LATENCY: { op: L; value: string }[] = [
  { op: { he: "גישה לזיכרון", en: "Main memory reference" }, value: "≈ 100 ns" },
  { op: { he: "קריאה אקראית מ־SSD", en: "SSD random read" }, value: "≈ 10–150 µs" },
  { op: { he: "round trip בתוך datacenter", en: "Round trip within a datacenter" }, value: "≈ 0.5 ms" },
  { op: { he: "round trip בין יבשות", en: "Round trip across continents" }, value: "≈ 150 ms" },
];

// ── Questions ─────────────────────────────────────────────────────────────────

export type SdKind = "frontend" | "fullstack" | "backend" | "ai";
export interface SdQuestion {
  id: string;
  kind: SdKind;
  title: L;
  clarify: L[];
  core: L[];
  deepDive: L[];
  pitfall: L;
}

export const SD_QUESTIONS: SdQuestion[] = [
  {
    id: "news-feed",
    kind: "fullstack",
    title: { he: "פיד חדשות (כמו רשת חברתית)", en: "News feed (social network)" },
    clarify: [
      {
        he: "סדר כרונולוגי או מדורג? כמה עוקבים יש למשתמש ממוצע ולמפורסם?",
        en: "Chronological or ranked? Followers for an average user vs a celebrity?",
      },
    ],
    core: [
      {
        he: "fan-out on write לרוב המשתמשים, fan-out on read למפורסמים.",
        en: "Fan-out on write for most users, fan-out on read for celebrities.",
      },
      { he: "feed cache לכל משתמש + pagination מבוסס cursor.", en: "A per-user feed cache plus cursor pagination." },
    ],
    deepDive: [
      {
        he: "infinite scroll ב־client: virtualization ושמירת מיקום הגלילה.",
        en: "Client infinite scroll: virtualization and keeping the scroll position.",
      },
    ],
    pitfall: {
      he: "לבחור fan-out אחד לכולם ולהתעלם ממשתמשים עם מיליוני עוקבים.",
      en: "Picking one fan-out for everyone and ignoring million-follower accounts.",
    },
  },
  {
    id: "autocomplete",
    kind: "frontend",
    title: { he: "השלמה אוטומטית (Autocomplete / typeahead)", en: "Autocomplete / typeahead" },
    clarify: [
      {
        he: "תוצאות מקומיות או מהשרת? כמה מהר צריך להופיע?",
        en: "Local or server results? How fast must they appear?",
      },
    ],
    core: [
      {
        he: "debounce, ביטול בקשות ישנות (AbortController), cache לפי prefix.",
        en: "Debounce, cancel stale requests (AbortController), cache by prefix.",
      },
      {
        he: "נגישות: combobox ARIA, ניווט מקלדת, הכרזה על מספר התוצאות.",
        en: "Accessibility: ARIA combobox, keyboard navigation, announce the result count.",
      },
    ],
    deepDive: [
      {
        he: "בשרת: trie או אינדקס prefix עם ניקוד פופולריות.",
        en: "Server side: a trie or prefix index with popularity scores.",
      },
    ],
    pitfall: {
      he: "race condition: תשובה ישנה דורסת חדשה.",
      en: "Race condition: an old response overwrites a newer one.",
    },
  },
  {
    id: "chat",
    kind: "fullstack",
    title: { he: "אפליקציית צ'אט", en: "Chat app" },
    clarify: [
      {
        he: "1:1 או קבוצות? אישורי קריאה? היסטוריה כמה זמן?",
        en: "1:1 or groups? Read receipts? How long is history kept?",
      },
    ],
    core: [
      {
        he: "WebSocket לחיבור חי, שירות presence, אחסון הודעות לפי שיחה.",
        en: "WebSocket for live connection, a presence service, messages stored per conversation.",
      },
      {
        he: "מזהה הודעה מה־client ל־idempotency וסדר.",
        en: "A client-generated message id for idempotency and ordering.",
      },
    ],
    deepDive: [
      {
        he: "סדר הודעות בין מכשירים, מצב offline ושליחה חוזרת.",
        en: "Ordering across devices, offline state and resend.",
      },
    ],
    pitfall: { he: "להניח שחיבור WebSocket אף פעם לא נופל.", en: "Assuming the WebSocket connection never drops." },
  },
  {
    id: "url-shortener",
    kind: "backend",
    title: { he: "מקצר כתובות", en: "URL shortener" },
    clarify: [{ he: "כינוי מותאם? תפוגה? אנליטיקה?", en: "Custom alias? Expiry? Analytics?" }],
    core: [
      {
        he: "יצירת מזהה: מונה + base62 או hash עם בדיקת התנגשות.",
        en: "Id generation: counter + base62, or a hash with collision checks.",
      },
      {
        he: "קריאות רבות מאוד: cache ו־redirect 301/302 לפי צורך באנליטיקה.",
        en: "Read-heavy: cache, and 301 vs 302 depending on analytics needs.",
      },
    ],
    deepDive: [
      {
        he: "מונה מבוזר בלי צוואר בקבוק (טווחים לכל שרת).",
        en: "A distributed counter without a bottleneck (ranges per server).",
      },
    ],
    pitfall: { he: "לשכוח שימוש לרעה: spam ו־phishing.", en: "Forgetting abuse: spam and phishing." },
  },
  {
    id: "upload",
    kind: "fullstack",
    title: { he: "העלאת תמונות וקבצים", en: "Image and file upload" },
    clarify: [{ he: "גודל מקסימלי? עיבוד (thumbnails)? פרטיות?", en: "Max size? Processing (thumbnails)? Privacy?" }],
    core: [
      {
        he: "presigned URL: ה־client מעלה ישירות ל־object storage.",
        en: "Presigned URLs: the client uploads straight to object storage.",
      },
      {
        he: "עיבוד אסינכרוני דרך queue, הגשה דרך CDN.",
        en: "Async processing through a queue, serving through a CDN.",
      },
    ],
    deepDive: [
      { he: "העלאה בחלקים (multipart) והמשך אחרי ניתוק.", en: "Multipart upload and resume after a disconnect." },
    ],
    pitfall: { he: "להעביר קבצים גדולים דרך שרת האפליקציה.", en: "Streaming big files through the app server." },
  },
  {
    id: "notifications",
    kind: "backend",
    title: { he: "מערכת התראות", en: "Notification system" },
    clarify: [
      {
        he: "ערוצים (push, email, in-app)? העדפות? שעות שקטות?",
        en: "Channels (push, email, in-app)? Preferences? Quiet hours?",
      },
    ],
    core: [
      {
        he: "אירועים ל־queue, שירות שמחליט לפי העדפות, worker לכל ערוץ.",
        en: "Events into a queue, a service that applies preferences, a worker per channel.",
      },
      { he: "dedupe ו־rate limit לכל משתמש.", en: "Dedupe and a per-user rate limit." },
    ],
    deepDive: [
      { he: "retries עם idempotency כדי לא לשלוח פעמיים.", en: "Retries with idempotency so nothing is sent twice." },
    ],
    pitfall: { he: "שליחה סינכרונית מתוך הבקשה של המשתמש.", en: "Sending synchronously inside the user's request." },
  },
  {
    id: "rate-limiter",
    kind: "backend",
    title: { he: "הגבלת קצב (Rate limiter)", en: "Rate limiter" },
    clarify: [{ he: "לפי משתמש, IP או מפתח? גבול קשיח או רך?", en: "Per user, IP or key? Hard or soft limit?" }],
    core: [
      {
        he: "token bucket או sliding window ב־store משותף (למשל Redis).",
        en: "Token bucket or sliding window in a shared store (e.g. Redis).",
      },
      { he: "תשובת 429 עם Retry-After.", en: "A 429 response with Retry-After." },
    ],
    deepDive: [
      {
        he: "פעולות אטומיות ומה עושים כשה־store נופל (fail open/closed).",
        en: "Atomic operations, and what happens when the store is down (fail open or closed).",
      },
    ],
    pitfall: { he: "מונה בזיכרון של כל שרת בנפרד.", en: "An in-memory counter on each server separately." },
  },
  {
    id: "collab-editor",
    kind: "frontend",
    title: { he: "עורך מסמכים שיתופי", en: "Collaborative document editor" },
    clarify: [
      {
        he: "כמה עורכים במקביל? offline? היסטוריית גרסאות?",
        en: "How many concurrent editors? Offline? Version history?",
      },
    ],
    core: [
      {
        he: "OT או CRDT לפתרון התנגשויות; WebSocket לסנכרון.",
        en: "OT or CRDT for conflict resolution; WebSocket for sync.",
      },
      { he: "סמני מיקום של משתתפים (presence).", en: "Participant cursors (presence)." },
    ],
    deepDive: [{ he: "snapshot + לוג פעולות לשחזור מהיר.", en: "Snapshot plus an operation log for fast restore." }],
    pitfall: { he: "last-write-wins על מסמך שלם.", en: "Last-write-wins on the whole document." },
  },
  {
    id: "checkout",
    kind: "fullstack",
    title: { he: "Checkout ותשלום", en: "Checkout and payment" },
    clarify: [{ he: "ספק תשלום חיצוני? מלאי מוגבל?", en: "External payment provider? Limited stock?" }],
    core: [
      {
        he: "idempotency key לכל ניסיון תשלום; state machine להזמנה.",
        en: "An idempotency key per payment attempt; a state machine for the order.",
      },
      { he: "webhooks מהספק עם אימות חתימה.", en: "Provider webhooks with signature verification." },
    ],
    deepDive: [
      { he: "שמירת מלאי זמנית ושחרור אחרי timeout.", en: "Temporary stock reservation and release after a timeout." },
    ],
    pitfall: { he: 'לסמן הזמנה כ"שולמה" לפי redirect מהדפדפן.', en: "Marking an order paid from a browser redirect." },
  },
  {
    id: "job-board",
    kind: "fullstack",
    title: { he: "לוח משרות עם חיפוש והתראות", en: "Job board with search and alerts" },
    clarify: [{ he: "מקורות משרות? טריות? התאמה אישית?", en: "Job sources? Freshness? Personal matching?" }],
    core: [
      {
        he: "ingestion מתוזמן, dedupe לפי hash של התוכן, אינדקס חיפוש.",
        en: "Scheduled ingestion, dedupe by content hash, a search index.",
      },
      {
        he: "התראות: התאמת משרות חדשות לחיפושים שמורים, digest ולא הודעה לכל משרה.",
        en: "Alerts: match new jobs against saved searches, send a digest rather than one message per job.",
      },
    ],
    deepDive: [{ he: "ניקוד התאמה אישי ו־cache לכל משתמש.", en: "Personal match scoring and a per-user cache." }],
    pitfall: { he: "לחשב התאמה לכל המשרות בכל טעינת עמוד.", en: "Scoring every job on every page load." },
  },
  {
    id: "data-table",
    kind: "frontend",
    title: { he: "טבלת נתונים / dashboard גדול", en: "Large data table / dashboard" },
    clarify: [
      {
        he: "כמה שורות? מיון וסינון בשרת או ב־client? עדכון חי?",
        en: "How many rows? Sort and filter on server or client? Live updates?",
      },
    ],
    core: [
      {
        he: "pagination או virtualization; state של מסננים ב־URL.",
        en: "Pagination or virtualization; filter state in the URL.",
      },
      {
        he: "במובייל: כרטיסים במקום טבלה רחבה, בלי גלילה אופקית.",
        en: "On mobile: cards instead of a wide table, no horizontal scroll.",
      },
    ],
    deepDive: [
      {
        he: "ביצועים: memoization, web worker לחישובים כבדים.",
        en: "Performance: memoization, a web worker for heavy computation.",
      },
    ],
    pitfall: { he: "לטעון 50,000 שורות לזיכרון של הדפדפן.", en: "Loading 50,000 rows into browser memory." },
  },
  {
    id: "rag-assistant",
    kind: "ai",
    title: { he: "עוזר צ'אט מבוסס LLM על מסמכי החברה (RAG)", en: "LLM chat assistant over company docs (RAG)" },
    clarify: [
      {
        he: "מי רשאי לראות אילו מסמכים? כמה עדכני? תקציב לבקשה?",
        en: "Who may see which documents? How fresh? Budget per request?",
      },
    ],
    core: [
      {
        he: "ingestion: חיתוך ל־chunks, embeddings, vector index עם הרשאות.",
        en: "Ingestion: chunking, embeddings, a vector index with permissions.",
      },
      {
        he: "בשאלה: retrieval, reranking, prompt עם ציטוטים, streaming לתשובה.",
        en: "At query time: retrieval, reranking, a prompt with citations, a streamed answer.",
      },
    ],
    deepDive: [
      {
        he: "evals: סט שאלות עם תשובות צפויות, מדידת retrieval בנפרד מהתשובה.",
        en: "Evals: a question set with expected answers; measure retrieval separately from the answer.",
      },
    ],
    pitfall: {
      he: "לשכוח הרשאות ב־retrieval ולחשוף מסמך למי שאסור.",
      en: "Ignoring permissions in retrieval and leaking a document.",
    },
  },
];

// ── AI-native topics ──────────────────────────────────────────────────────────

export interface SdAiTopic {
  id: string;
  title: L;
  why: L;
  points: L[];
  ask: L;
  sources: string[];
}

export const SD_AI_TOPICS: SdAiTopic[] = [
  {
    id: "integration",
    title: { he: "שילוב LLM במוצר", en: "Integrating an LLM into a product" },
    why: {
      he: "מודל הוא תלות חיצונית איטית, יקרה ולא דטרמיניסטית; מתכננים סביבה כמו סביב כל שירות לא אמין.",
      en: "A model is a slow, costly, non-deterministic external dependency; design around it like any unreliable service.",
    },
    points: [
      {
        he: "structured output עם schema ובדיקת התשובה (למשל zod).",
        en: "Structured output with a schema, and validate the response (e.g. zod).",
      },
      {
        he: "timeouts, retries מוגבלים, ו־fallback מבוסס חוקים כשהמודל לא זמין.",
        en: "Timeouts, bounded retries, and a rule-based fallback when the model is unavailable.",
      },
      { he: "streaming כדי לקצר את הזמן עד הטוקן הראשון.", en: "Streaming to cut time to first token." },
    ],
    ask: { he: "מה המשתמש רואה כשהמודל נכשל?", en: "What does the user see when the model fails?" },
    sources: ["gemini", "openai"],
  },
  {
    id: "rag",
    title: { he: "RAG – אחזור והעשרת תשובות", en: "RAG (retrieval-augmented generation)" },
    why: {
      he: "מעגן את התשובה במסמכים שלך במקום בזיכרון של המודל, ומאפשר ציטוט.",
      en: "Grounds answers in your documents instead of the model's memory, and makes citations possible.",
    },
    points: [
      {
        he: "chunking לפי מבנה המסמך, embeddings, ולעתים חיפוש היברידי (מילות מפתח + וקטורים).",
        en: "Chunk by document structure, embeddings, and often hybrid search (keywords + vectors).",
      },
      {
        he: "reranking לפני ה־prompt; לשמור מזהה מקור לכל chunk.",
        en: "Rerank before the prompt; keep a source id on every chunk.",
      },
      {
        he: "הרשאות וטריות הם חלק מה־retrieval, לא תוספת.",
        en: "Permissions and freshness are part of retrieval, not an afterthought.",
      },
    ],
    ask: {
      he: "איך יודעים אם הבעיה ב־retrieval או ביצירה?",
      en: "How do you tell a retrieval problem from a generation problem?",
    },
    sources: ["rag"],
  },
  {
    id: "prompts",
    title: { he: "Prompts כקוד", en: "Prompts as code" },
    why: {
      he: "prompt הוא חלק מהלוגיקה: צריך גרסאות, בדיקות ו־review.",
      en: "A prompt is part of the logic: it needs versions, tests and review.",
    },
    points: [
      {
        he: "הוראות ברורות, דוגמאות (few-shot), הפרדה בין הוראות לנתוני משתמש.",
        en: "Clear instructions, examples (few-shot), separate instructions from user data.",
      },
      { he: "לבקש פורמט מוגדר ולבדוק אותו בקוד.", en: "Ask for a defined format and check it in code." },
      {
        he: "לשמור prompts בקבצים עם גרסה ולהריץ evals בכל שינוי.",
        en: "Keep prompts in versioned files and run evals on every change.",
      },
    ],
    ask: {
      he: "איך תוודא ששינוי ב־prompt לא שבר מקרים קיימים?",
      en: "How do you make sure a prompt change didn't break existing cases?",
    },
    sources: ["gemini", "openai", "anthropic"],
  },
  {
    id: "evals",
    title: { he: "הערכת איכות (Evals)", en: "Evals" },
    why: {
      he: "בלי מדידה אין דרך לדעת אם שינוי שיפר או קלקל.",
      en: "Without measurement there is no way to know whether a change helped or hurt.",
    },
    points: [
      { he: "להתחיל בניתוח שגיאות ידני של פלטים אמיתיים.", en: "Start with manual error analysis of real outputs." },
      {
        he: "בדיקות קוד פשוטות (assertions) לכל מה שאפשר לבדוק בלי מודל.",
        en: "Simple code assertions for everything checkable without a model.",
      },
      {
        he: "LLM-as-judge רק אחרי שבדקת שהוא מסכים עם שיפוט אנושי.",
        en: "LLM-as-judge only after checking it agrees with human judgment.",
      },
    ],
    ask: { he: "מה סט ה־eval שלך ואיך הוא נבנה?", en: "What is your eval set and how was it built?" },
    sources: ["evals"],
  },
  {
    id: "cost-latency",
    title: { he: "עלות ו־latency", en: "Cost and latency" },
    why: {
      he: "כל קריאה עולה כסף וזמן; בקנה מידה זה מחליט על ההיתכנות.",
      en: "Every call costs money and time; at scale this decides feasibility.",
    },
    points: [
      {
        he: "cache לתשובות (לפי hash של הקלט), מכסות לכל משתמש.",
        en: "Cache responses (by input hash), quotas per user.",
      },
      {
        he: "מודל קטן למשימות פשוטות, גדול רק כשצריך (routing).",
        en: "A small model for simple tasks, a large one only when needed (routing).",
      },
      {
        he: "לקצץ context: רק מה שרלוונטי נכנס ל־prompt.",
        en: "Trim context: only what is relevant goes into the prompt.",
      },
    ],
    ask: {
      he: "כמה עולה משתמש פעיל בחודש, ואיך תגביל את זה?",
      en: "What does an active user cost per month, and how do you cap it?",
    },
    sources: ["openai", "gemini"],
  },
  {
    id: "safety",
    title: { he: "אבטחה ובטיחות", en: "Security and safety" },
    why: {
      he: "קלט של משתמש (או מסמך) יכול לשנות את התנהגות המודל.",
      en: "User (or document) input can change the model's behavior.",
    },
    points: [
      {
        he: "prompt injection: להתייחס לכל טקסט חיצוני כנתונים, לא כהוראות.",
        en: "Prompt injection: treat all external text as data, not instructions.",
      },
      {
        he: "improper output handling: לא להריץ או לרנדר פלט מודל בלי בדיקה (XSS, SQL).",
        en: "Improper output handling: never execute or render model output unchecked (XSS, SQL).",
      },
      {
        he: "sensitive information disclosure ו־unbounded consumption: לסנן מידע אישי ולהגביל שימוש.",
        en: "Sensitive information disclosure and unbounded consumption: filter personal data and cap usage.",
      },
    ],
    ask: {
      he: 'מה קורה אם מסמך שה־RAG שלף מכיל "התעלם מההוראות"?',
      en: 'What happens if a retrieved document says "ignore your instructions"?',
    },
    sources: ["owasp", "nist"],
  },
  {
    id: "agents",
    title: { he: "Agents ו־tool calling", en: "Agents and tool calling" },
    why: {
      he: "מודל שמפעיל כלים יכול לעשות נזק אמיתי; פשטות עדיפה.",
      en: "A model that calls tools can do real damage; simpler is better.",
    },
    points: [
      {
        he: "להתחיל ב־workflow קבוע; agent רק כשהמסלול באמת לא ידוע מראש.",
        en: "Start with a fixed workflow; use an agent only when the path really can't be known upfront.",
      },
      {
        he: "least privilege לכלים ואישור אנושי לפעולות בלתי הפיכות.",
        en: "Least privilege for tools and human approval for irreversible actions.",
      },
      { he: "מגבלת צעדים, לוג של כל קריאה לכלי.", en: "A step limit and a log of every tool call." },
    ],
    ask: { he: "איזה כלי אסור לתת ל־agent בלי אישור?", en: "Which tool must never run without approval?" },
    sources: ["agents", "owasp"],
  },
  {
    id: "governance",
    title: { he: "ניטור וממשל", en: "Monitoring and governance" },
    why: {
      he: "התנהגות מודל משתנה עם גרסאות ונתונים; צריך לראות את זה בזמן.",
      en: "Model behavior shifts with versions and data; you need to see it in time.",
    },
    points: [
      {
        he: "לוג של קלט/פלט (בלי מידע אישי מיותר), עלות ו־latency לכל קריאה.",
        en: "Log input/output (without unneeded personal data), cost and latency per call.",
      },
      { he: "משוב משתמשים כ־signal ל־eval הבא.", en: "User feedback as a signal for the next eval." },
      { he: "מסגרת סיכונים: Govern, Map, Measure, Manage.", en: "A risk framework: Govern, Map, Measure, Manage." },
    ],
    ask: { he: "איך תדע שגרסת מודל חדשה גרועה יותר?", en: "How would you know a new model version is worse?" },
    sources: ["nist", "evals"],
  },
];
