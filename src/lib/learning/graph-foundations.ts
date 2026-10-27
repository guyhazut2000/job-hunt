import type { SkillNode } from "./types";

/** Foundations + cross-cutting DevOps practices. Original content; resources are links only. */
export const FOUNDATION_SKILLS: SkillNode[] = [
  {
    id: "linux",
    label: "Linux",
    aliases: ["bash", "shell", "unix", "ubuntu", "rhel", "shell scripting"],
    category: "foundations",
    prerequisites: [],
    hours: 30,
    summary: {
      he: "מערכת ההפעלה של רוב השרתים והענן. בלי שליטה בטרמינל קשה להתקדם ב-DevOps ובבקאנד.",
      en: "The OS behind most servers and clouds. Terminal fluency is the base for DevOps and backend work.",
    },
    stages: {
      fundamentals: [
        "Filesystem & permissions",
        "Shell basics (cd, ls, grep, find)",
        "Processes & signals",
        "Package managers",
      ],
      intermediate: ["Bash scripting", "systemd & services", "Users, groups, sudo", "Logs & journalctl", "SSH & keys"],
      applied: ["Troubleshooting CPU/memory/disk", "cron & automation", "Hardening basics"],
    },
    docs: { title: "The Linux Documentation Project", url: "https://tldp.org/", by: "TLDP" },
    course: {
      title: "Introduction to Linux (LFS101)",
      url: "https://training.linuxfoundation.org/training/introduction-to-linux/",
      by: "Linux Foundation",
    },
    project: {
      he: "כתבו סקריפט Bash שמגבה תיקייה כל לילה עם cron, שומר 7 גיבויים אחרונים ושולח שורת סיכום ללוג.",
      en: "Write a Bash script that backs up a folder nightly via cron, keeps the last 7 archives and logs a summary line.",
    },
    roadmapSh: "linux",
  },
  {
    id: "networking",
    label: "Networking",
    aliases: ["tcp/ip", "dns", "http", "computer networks", "networks"],
    category: "foundations",
    prerequisites: [],
    hours: 25,
    summary: {
      he: "איך מחשבים מדברים: IP, TCP, DNS ו-HTTP. בסיס חובה לענן, לקונטיינרים ולדיבאג תקלות.",
      en: "How machines talk: IP, TCP, DNS and HTTP. Required for cloud, containers and debugging outages.",
    },
    stages: {
      fundamentals: ["OSI / TCP-IP layers", "IP addressing & subnets (CIDR)", "TCP vs UDP", "DNS resolution"],
      intermediate: ["HTTP/1.1, HTTP/2, TLS", "NAT, routing, firewalls", "Load balancers & proxies"],
      applied: ["Debugging with curl, dig, tcpdump", "VPC design basics"],
    },
    docs: {
      title: "MDN: How does the Internet work?",
      url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Web_mechanics/How_does_the_Internet_work",
      by: "MDN",
    },
    course: {
      title: "Computer Networking: A Top-Down Approach, video lectures",
      url: "https://gaia.cs.umass.edu/kurose_ross/lectures.php",
      by: "Kurose & Ross (UMass Amherst)",
    },
    project: {
      he: "בנו כלי CLI קטן שמקבל דומיין ומציג את שרשרת ה-DNS, זמן ה-TCP handshake, זמן ה-TLS ותגובת HTTP.",
      en: "Build a small CLI that takes a domain and prints the DNS chain, TCP handshake time, TLS time and HTTP response.",
    },
    roadmapSh: "computer-science",
  },
  {
    id: "git",
    label: "Git",
    aliases: ["github", "gitlab", "version control", "bitbucket"],
    category: "foundations",
    prerequisites: [],
    hours: 10,
    summary: {
      he: "ניהול גרסאות. כל צוות פיתוח עובד עם Git ו-Pull Requests.",
      en: "Version control. Every dev team works with Git and pull requests.",
    },
    stages: {
      fundamentals: ["commit, branch, merge", "remote, push, pull", ".gitignore"],
      intermediate: ["rebase vs merge", "Resolving conflicts", "Pull request workflow"],
      applied: ["Git hooks", "Bisect & history rewriting", "Monorepo basics"],
    },
    docs: { title: "Pro Git book", url: "https://git-scm.com/book/en/v2", by: "git-scm.com" },
    course: {
      title: "The Missing Semester of Your CS Education: Version Control",
      url: "https://missing.csail.mit.edu/2020/version-control/",
      by: "MIT CSAIL",
    },
    project: {
      he: "קחו פרויקט קיים שלכם, עבדו עם branches ו-PR מול עצמכם, ופתרו בכוונה קונפליקט אחד ב-rebase.",
      en: "Take one of your projects, work through branches and PRs, and deliberately resolve a rebase conflict.",
    },
    roadmapSh: "git-github",
  },
  {
    id: "html-css",
    label: "HTML & CSS",
    aliases: ["html", "css", "html5", "css3", "sass", "scss"],
    category: "foundations",
    prerequisites: [],
    hours: 25,
    summary: {
      he: "שפת המבנה והעיצוב של הווב. בסיס לכל עבודת פרונטאנד.",
      en: "The structure and styling languages of the web. The base of all frontend work.",
    },
    stages: {
      fundamentals: ["Semantic HTML", "Box model", "Selectors & cascade", "Forms"],
      intermediate: ["Flexbox & Grid", "Responsive design", "Accessibility (a11y)", "RTL with logical properties"],
      applied: ["Design tokens", "CSS architecture"],
    },
    docs: {
      title: "MDN Web Docs: Learn web development",
      url: "https://developer.mozilla.org/en-US/docs/Learn_web_development",
      by: "MDN",
    },
    course: {
      title: "CS50's Web Programming with Python and JavaScript",
      url: "https://cs50.harvard.edu/web/",
      by: "Harvard",
    },
    project: {
      he: "בנו דף נחיתה רספונסיבי בעברית (RTL) לסטארטאפ דמיוני, בלי פריימוורק, שעובר בדיקת נגישות.",
      en: "Build a responsive Hebrew (RTL) landing page for a fictional startup, framework-free, passing an accessibility audit.",
    },
    roadmapSh: "frontend",
  },
  {
    id: "ci-cd",
    label: "CI/CD",
    aliases: ["ci", "cd", "continuous integration", "continuous delivery", "continuous deployment"],
    category: "devops",
    prerequisites: ["git"],
    hours: 15,
    summary: {
      he: "בנייה, בדיקה ופריסה אוטומטיות בכל שינוי קוד.",
      en: "Automated build, test and deploy on every code change.",
    },
    stages: {
      fundamentals: ["Pipelines, stages, jobs", "Build artifacts", "Running tests in CI"],
      intermediate: ["Secrets management", "Caching", "Environments & approvals"],
      applied: ["Blue/green & canary deploys", "Rollback strategy"],
    },
    docs: {
      title: "GitHub Actions: Continuous integration",
      url: "https://docs.github.com/en/actions/get-started/continuous-integration",
      by: "GitHub",
    },
    course: {
      title: "Introduction to DevOps and Site Reliability Engineering (LFS162)",
      url: "https://training.linuxfoundation.org/training/introduction-to-devops-and-site-reliability-engineering-lfs162/",
      by: "Linux Foundation",
    },
    project: {
      he: "הוסיפו לפרויקט pipeline שמריץ lint ובדיקות על כל PR, ובונה ומפרסם image רק אחרי merge.",
      en: "Add a pipeline that runs lint and tests on every PR and builds and publishes an image only after merge.",
    },
    roadmapSh: "devops",
  },
  {
    id: "observability",
    label: "Observability",
    aliases: ["monitoring", "opentelemetry", "otel", "logging", "tracing", "datadog", "new relic"],
    category: "devops",
    prerequisites: ["linux"],
    hours: 15,
    summary: {
      he: "לוגים, מטריקות ו-tracing: איך יודעים מה קורה בפרודקשן לפני שהלקוח מתלונן.",
      en: "Logs, metrics and traces: knowing what production is doing before customers complain.",
    },
    stages: {
      fundamentals: ["Logs vs metrics vs traces", "Golden signals", "Structured logging"],
      intermediate: ["OpenTelemetry instrumentation", "SLIs, SLOs, error budgets", "Alerting"],
      applied: ["Distributed tracing across services", "On-call runbooks"],
    },
    docs: { title: "OpenTelemetry documentation", url: "https://opentelemetry.io/docs/", by: "OpenTelemetry (CNCF)" },
    course: {
      title: "Getting Started with OpenTelemetry (LFS148)",
      url: "https://training.linuxfoundation.org/training/getting-started-with-opentelemetry-lfs148/",
      by: "Linux Foundation",
    },
    project: {
      he: "הוסיפו OpenTelemetry לשני שירותים קטנים שמדברים ביניהם, וראו trace אחד שעובר דרך שניהם.",
      en: "Instrument two small services that call each other with OpenTelemetry and follow one trace across both.",
    },
  },
];
