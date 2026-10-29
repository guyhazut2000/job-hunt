/**
 * Curated, original starter content for the concepts glossary (docs/concepts.md):
 * suggestions, a few hand-written overviews (so the most common concepts work offline and cost no AI),
 * and official links. All text here is written for this app — nothing is copied from roadmap.sh or elsewhere.
 * Every URL was checked to resolve when added.
 */
import type { Locale } from "@/lib/i18n/dictionaries";
import type { ConceptCategory, ConceptOverview } from "./core";
import { conceptSlug } from "./core";

export interface Suggestion {
  name: string;
  category: ConceptCategory;
}

/** Starter suggestions on the concepts page, by category. */
export const STARTER_SUGGESTIONS: Suggestion[] = [
  { name: "Docker", category: "devops" },
  { name: "Docker image layers", category: "devops" },
  { name: "Docker best practices", category: "devops" },
  { name: "CI/CD", category: "devops" },
  { name: "Blue-green deployment", category: "devops" },
  { name: "OSI model", category: "networking" },
  { name: "DNS", category: "networking" },
  { name: "TCP vs UDP", category: "networking" },
  { name: "Feature-based structure", category: "architecture" },
  { name: "Microservices vs monolith", category: "architecture" },
  { name: "Idempotency", category: "architecture" },
  { name: "sudo", category: "cli-os" },
  { name: "Homebrew", category: "cli-os" },
  { name: "File permissions (chmod)", category: "cli-os" },
  { name: "Environment variables", category: "cli-os" },
  { name: "Database indexes", category: "data" },
  { name: "JWT", category: "security" },
  { name: "Production readiness", category: "practices" },
];

/** "Concepts around X" on a roadmap skill page. Keys are roadmap skill ids (src/lib/learning/graph-*.ts). */
export const SKILL_SUGGESTIONS: Record<string, string[]> = {
  docker: ["OSI model", "Docker image layers", "Docker best practices", "Containers vs VMs", "Multi-stage builds"],
  kubernetes: ["Pods", "Kubernetes Services", "Ingress", "Liveness and readiness probes", "Horizontal Pod Autoscaler"],
  helm: ["Helm charts", "Kubernetes manifests", "Templating"],
  terraform: ["Infrastructure as Code", "Terraform state", "Idempotency"],
  ansible: ["Infrastructure as Code", "Idempotency", "SSH"],
  linux: ["sudo", "File permissions (chmod)", "Processes and signals", "systemd", "Environment variables"],
  networking: ["OSI model", "DNS", "TCP vs UDP", "Load balancer", "TLS"],
  git: ["Rebase vs merge", "Feature branches", "Pull requests"],
  "ci-cd": ["CI/CD", "Blue-green deployment", "Canary release", "Feature flags"],
  "github-actions": ["CI/CD", "Secrets management", "Build cache"],
  jenkins: ["CI/CD", "Pipeline as code"],
  aws: ["IAM", "VPC", "Shared responsibility model", "Regions and availability zones"],
  gcp: ["IAM", "VPC", "Regions and availability zones"],
  azure: ["IAM", "VPC", "Regions and availability zones"],
  observability: ["Logs, metrics and traces", "SLO and SLA", "Alert fatigue"],
  prometheus: ["Logs, metrics and traces", "Time series", "SLO and SLA"],
  grafana: ["Logs, metrics and traces", "SLO and SLA"],
  postgresql: ["Database indexes", "Transactions and isolation levels", "Connection pooling", "Migrations"],
  mysql: ["Database indexes", "Transactions and isolation levels", "Replication"],
  mongodb: ["Document model", "Database indexes", "Sharding"],
  redis: ["Caching strategies", "Cache invalidation", "Pub/Sub"],
  kafka: ["Event-driven architecture", "Consumer groups", "At-least-once delivery"],
  rabbitmq: ["Message queues", "At-least-once delivery", "Dead-letter queue"],
  sql: ["Database indexes", "Joins", "Transactions and isolation levels"],
  react: ["Virtual DOM", "React hooks", "State management", "Feature-based structure"],
  nextjs: ["Server components", "SSR vs SSG", "Feature-based structure", "Caching strategies"],
  nodejs: ["Event loop", "Environment variables", "Feature-based structure"],
  typescript: ["Type narrowing", "Generics", "Structural typing"],
  javascript: ["Event loop", "Closures", "Promises and async/await"],
  python: ["Virtual environments", "GIL", "Decorators"],
  go: ["Goroutines", "Channels", "Context cancellation"],
  java: ["JVM", "Garbage collection", "Dependency injection"],
  spring: ["Dependency injection", "Inversion of control"],
  graphql: ["N+1 problem", "Schema-first design"],
  grpc: ["Protocol Buffers", "HTTP/2"],
  llm: ["Tokens and context window", "RAG", "Embeddings", "Prompt injection"],
  langchain: ["RAG", "Embeddings", "Agents and tools"],
};

/** Company-specific suggestions by company slug; every company also gets the generic ones. */
export const COMPANY_SUGGESTIONS: Record<string, string[]> = {
  amazon: ["Leadership Principles", "STAR method", "Bar Raiser", "Working backwards", "Two-pizza teams"],
  google: ["Googleyness", "Structured interviews", "System design interview"],
  microsoft: ["Growth mindset", "Behavioral interview", "System design interview"],
  meta: ["Move fast", "Coding interview", "System design interview"],
  apple: ["Secrecy and need-to-know", "Behavioral interview"],
  nvidia: ["Technical deep-dive interview", "CUDA"],
  "monday-com": ["Product-led growth", "Behavioral interview"],
  wix: ["Home assignment", "Behavioral interview"],
};
export const GENERIC_COMPANY_SUGGESTIONS = ["Interview process", "Engineering culture", "Company values"];

export function companySuggestions(companySlug: string): string[] {
  const own = COMPANY_SUGGESTIONS[companySlug] ?? [];
  return [...own, ...GENERIC_COMPANY_SUGGESTIONS.filter((g) => !own.includes(g))];
}

export interface OfficialLink {
  label: string;
  url: string;
}

/** Official company pages (careers / hiring / culture). Only links — the app never fetches or copies them. */
export const COMPANY_SOURCES: Record<string, OfficialLink[]> = {
  amazon: [
    {
      label: "amazon.jobs — Leadership Principles",
      url: "https://www.amazon.jobs/content/en/our-workplace/leadership-principles",
    },
    {
      label: "amazon.jobs — Interviewing at Amazon",
      url: "https://www.amazon.jobs/content/en/how-we-hire/interviewing-at-amazon",
    },
  ],
  google: [
    { label: "Google Careers — How we hire", url: "https://www.google.com/about/careers/applications/how-we-hire/" },
    {
      label: "Google Careers — Interview tips",
      url: "https://www.google.com/about/careers/applications/interview-tips/",
    },
  ],
  microsoft: [
    {
      label: "Microsoft Careers — Interview tips",
      url: "https://careers.microsoft.com/v2/global/en/hiring-tips/interview-tips",
    },
  ],
  meta: [
    { label: "Meta Careers", url: "https://www.metacareers.com/" },
    { label: "Meta — SWE onsite prep", url: "https://www.metacareers.com/swe-prep-onsite" },
  ],
  apple: [{ label: "Apple Careers", url: "https://www.apple.com/careers/us/" }],
  nvidia: [{ label: "NVIDIA Careers", url: "https://www.nvidia.com/en-us/about-nvidia/careers/" }],
  "monday-com": [{ label: "monday.com Careers", url: "https://monday.com/careers" }],
  wix: [{ label: "Wix Jobs", url: "https://www.wix.com/jobs" }],
  mobileye: [{ label: "Mobileye Careers", url: "https://www.mobileye.com/careers/" }],
};

/** Official / reference docs for curated tech concepts (by slug). */
export const CONCEPT_DOCS: Record<string, OfficialLink> = {
  docker: { label: "Docker docs — overview", url: "https://docs.docker.com/get-started/docker-overview/" },
  "docker-image-layers": {
    label: "Docker docs — image layers",
    url: "https://docs.docker.com/get-started/docker-concepts/building-images/understanding-image-layers/",
  },
  "docker-best-practices": {
    label: "Docker docs — best practices",
    url: "https://docs.docker.com/build/building/best-practices/",
  },
  homebrew: { label: "brew.sh", url: "https://brew.sh/" },
  sudo: { label: "sudo.ws", url: "https://www.sudo.ws/" },
  dns: { label: "MDN — DNS", url: "https://developer.mozilla.org/en-US/docs/Glossary/DNS" },
  "osi-model": { label: "Wikipedia — OSI model", url: "https://en.wikipedia.org/wiki/OSI_model" },
  "ci-cd": {
    label: "GitHub Docs — continuous integration",
    url: "https://docs.github.com/en/actions/about-github-actions/about-continuous-integration-with-github-actions",
  },
  "feature-based-structure": {
    label: "Next.js docs — project structure",
    url: "https://nextjs.org/docs/app/getting-started/project-structure",
  },
  "star-method": {
    label: "Wikipedia — STAR method",
    url: "https://en.wikipedia.org/wiki/Situation,_task,_action,_result",
  },
};

/** Roadmap skill ids for curated concepts that map to one. */
export const CONCEPT_SKILL: Record<string, string> = {
  docker: "docker",
  "docker-image-layers": "docker",
  "docker-best-practices": "docker",
  "ci-cd": "ci-cd",
  sudo: "linux",
  "osi-model": "networking",
  dns: "networking",
  kubernetes: "kubernetes",
  git: "git",
};

type Bi = Record<Locale, ConceptOverview>;

/** Hand-written overviews (he/en). Keyed by canonical slug; company ones by "company~slug". */
export const CURATED: Record<string, Bi> = {
  docker: {
    en: {
      summary:
        "Docker packages an app together with everything it needs (runtime, libraries, config) into an image, and runs it as an isolated container.",
      why: 'It removes "works on my machine": the same image runs identically on a laptop, in CI and in production, and starts in seconds.',
      how: "You describe the image in a Dockerfile, build it, then run containers from it locally or push it to a registry for servers to pull.",
      example: {
        code: "docker build -t my-app .\ndocker run -p 3000:3000 my-app",
        caption: "Build an image from the Dockerfile in this folder, then run it and expose port 3000.",
      },
      keyPoints: [
        "Image = read-only template; container = a running instance of it.",
        "Containers share the host kernel, so they are much lighter than VMs.",
        "Images are built from cached layers — order Dockerfile steps from least to most changing.",
        "State that must survive goes in volumes, not inside the container.",
      ],
      related: [
        { name: "Docker image layers", why: "How builds are cached and images stay small" },
        { name: "Containers vs VMs", why: "What isolation you actually get" },
        { name: "Docker best practices", why: "Small, secure, reproducible images" },
        { name: "Kubernetes", why: "Running many containers in production" },
        { name: "OSI model", why: "Understanding container networking and ports" },
      ],
      category: "devops",
    },
    he: {
      summary:
        "Docker אורז אפליקציה יחד עם כל מה שהיא צריכה (runtime, ספריות, קונפיגורציה) ל-image, ומריץ אותה כ-container מבודד.",
      why: 'זה פותר את "אצלי זה עובד": אותו image רץ אותו דבר במחשב, ב-CI וב-production, ועולה תוך שניות.',
      how: "מתארים את ה-image בקובץ Dockerfile, בונים אותו, ואז מריצים ממנו containers מקומית או דוחפים ל-registry שהשרתים מושכים ממנו.",
      example: {
        code: "docker build -t my-app .\ndocker run -p 3000:3000 my-app",
        caption: "בונה image מה-Dockerfile שבתיקייה, ומריץ אותו עם port 3000 פתוח.",
      },
      keyPoints: [
        "Image = תבנית לקריאה בלבד; container = מופע רץ שלה.",
        "Containers חולקים את ה-kernel של המארח, ולכן קלים בהרבה מ-VM.",
        "Images בנויים משכבות (layers) עם cache — מסדרים את שלבי ה-Dockerfile מהיציב למשתנה.",
        "מידע שצריך לשרוד שומרים ב-volumes, לא בתוך ה-container.",
      ],
      related: [
        { name: "Docker image layers", why: "איך ה-build נשמר ב-cache וה-image נשאר קטן" },
        { name: "Containers vs VMs", why: "איזה בידוד באמת מקבלים" },
        { name: "Docker best practices", why: "Images קטנים, מאובטחים ושחזוריים" },
        { name: "Kubernetes", why: "הרצת הרבה containers ב-production" },
        { name: "OSI model", why: "להבין networking ו-ports של containers" },
      ],
      category: "devops",
    },
  },
  "docker-image-layers": {
    en: {
      summary:
        "Every instruction in a Dockerfile (RUN, COPY, ADD) creates a read-only layer; an image is a stack of these layers.",
      why: "Layers are cached and shared: if a step and everything before it did not change, Docker reuses it, so rebuilds and pulls are fast.",
      how: "Put rarely-changing steps (base image, installing dependencies) first and frequently-changing ones (copying source) last.",
      example: {
        code: "COPY package*.json ./\nRUN npm ci\nCOPY . .",
        caption:
          "Dependencies are installed in their own cached layer; editing source code only rebuilds the last step.",
      },
      keyPoints: [
        "A change invalidates that layer and every layer after it.",
        "Deleting a file in a later layer does not shrink the image — the earlier layer still holds it.",
        "Multi-stage builds keep build tools out of the final image.",
        "`docker history <image>` shows each layer and its size.",
      ],
      related: [
        { name: "Multi-stage builds", why: "Ship only what runs" },
        { name: "Docker best practices", why: "Putting layer ordering to work" },
        { name: "Build cache", why: "Same idea in CI pipelines" },
      ],
      category: "devops",
    },
    he: {
      summary: "כל פקודה ב-Dockerfile (RUN, COPY, ADD) יוצרת layer לקריאה בלבד; image הוא ערימה של layers כאלה.",
      why: "ה-layers נשמרים ב-cache ומשותפים: אם שלב וכל מה שלפניו לא השתנו, Docker משתמש בו שוב — לכן build ו-pull מהירים.",
      how: "שמים קודם שלבים שמשתנים לעיתים רחוקות (base image, התקנת dependencies) ובסוף את מה שמשתנה הרבה (העתקת הקוד).",
      example: {
        code: "COPY package*.json ./\nRUN npm ci\nCOPY . .",
        caption: "ה-dependencies מותקנים ב-layer משלהם; שינוי בקוד בונה מחדש רק את השלב האחרון.",
      },
      keyPoints: [
        "שינוי פוסל את ה-layer הזה ואת כל מה שאחריו.",
        "מחיקת קובץ ב-layer מאוחר לא מקטינה את ה-image — ה-layer הקודם עדיין מחזיק אותו.",
        "Multi-stage builds משאירים את כלי ה-build מחוץ ל-image הסופי.",
        "`docker history <image>` מציג כל layer ואת הגודל שלו.",
      ],
      related: [
        { name: "Multi-stage builds", why: "לשלוח רק את מה שרץ" },
        { name: "Docker best practices", why: "סדר layers בפועל" },
        { name: "Build cache", why: "אותו רעיון ב-CI" },
      ],
      category: "devops",
    },
  },
  "osi-model": {
    en: {
      summary:
        "The OSI model splits network communication into 7 layers, from physical signals (1) up to the application (7).",
      why: 'It gives a shared vocabulary for where a problem lives — "it\'s a layer 7 issue" means the network is fine but the app/protocol is not.',
      how: "Use it when debugging: check link → IP reachability → port/TCP → TLS → HTTP, layer by layer, instead of guessing.",
      example: {
        code: "ping api.example.com      # L3: is the host reachable?\nnc -zv api.example.com 443  # L4: is the port open?\ncurl -v https://api.example.com  # L5–7: TLS + HTTP",
        caption: "Walking up the layers to find where a connection breaks.",
      },
      keyPoints: [
        "L1 Physical, L2 Data link (MAC), L3 Network (IP), L4 Transport (TCP/UDP), L5 Session, L6 Presentation, L7 Application.",
        "Real-world stacks (TCP/IP) merge L5–L7 into one application layer.",
        "Load balancers are described as L4 (by IP/port) or L7 (by HTTP path/headers).",
      ],
      related: [
        { name: "TCP vs UDP", why: "The two main layer-4 choices" },
        { name: "DNS", why: "The layer-7 lookup before every connection" },
        { name: "Load balancer", why: "L4 vs L7 balancing" },
        { name: "TLS", why: "Encryption between transport and application" },
      ],
      category: "networking",
    },
    he: {
      summary: "מודל OSI מחלק תקשורת רשת ל-7 שכבות — מאותות פיזיים (1) ועד האפליקציה (7).",
      why: 'הוא נותן שפה משותפת למיקום הבעיה — "זו בעיה ב-layer 7" אומר שהרשת תקינה אבל האפליקציה/הפרוטוקול לא.',
      how: "משתמשים בו בדיבאג: בודקים חיבור → הגעה ל-IP → port/TCP → TLS → HTTP, שכבה אחרי שכבה, במקום לנחש.",
      example: {
        code: "ping api.example.com      # L3: is the host reachable?\nnc -zv api.example.com 443  # L4: is the port open?\ncurl -v https://api.example.com  # L5–7: TLS + HTTP",
        caption: "עולים בשכבות עד שמוצאים איפה החיבור נשבר.",
      },
      keyPoints: [
        "L1 Physical, L2 Data link (MAC), L3 Network (IP), L4 Transport (TCP/UDP), L5 Session, L6 Presentation, L7 Application.",
        "בפועל (TCP/IP) שכבות 5–7 מאוחדות לשכבת application אחת.",
        "Load balancers מתוארים כ-L4 (לפי IP/port) או L7 (לפי HTTP path/headers).",
      ],
      related: [
        { name: "TCP vs UDP", why: "שתי האפשרויות העיקריות ב-layer 4" },
        { name: "DNS", why: "החיפוש ב-layer 7 לפני כל חיבור" },
        { name: "Load balancer", why: "איזון ב-L4 מול L7" },
        { name: "TLS", why: "הצפנה בין transport ל-application" },
      ],
      category: "networking",
    },
  },
  sudo: {
    en: {
      summary:
        "sudo runs a single command with another user's privileges — usually root — after checking you are allowed to.",
      why: "You work as a normal user and only elevate when needed, which limits damage from mistakes and leaves an audit log.",
      how: "Prefix the command that needs admin rights; permissions are configured in /etc/sudoers (edit it only with visudo).",
      example: { code: "sudo apt update\nsudo -u postgres psql", caption: "Run as root, or as a specific user (-u)." },
      keyPoints: [
        "It asks for your own password, not root's.",
        "`sudo -l` lists what you are allowed to run.",
        "Avoid `sudo` for package managers like npm or pip in your home directory — it causes permission mess.",
      ],
      related: [
        { name: "File permissions (chmod)", why: "What sudo is bypassing" },
        { name: "Principle of least privilege", why: "The idea behind it" },
        { name: "Environment variables", why: "sudo resets most of them" },
      ],
      category: "cli-os",
    },
    he: {
      summary: "sudo מריץ פקודה אחת עם ההרשאות של משתמש אחר — בדרך כלל root — אחרי בדיקה שמותר לך.",
      why: "עובדים כמשתמש רגיל ומעלים הרשאות רק כשצריך — זה מגביל נזק מטעויות ומשאיר audit log.",
      how: "מוסיפים sudo לפני הפקודה שצריכה הרשאות admin; ההרשאות מוגדרות ב-/etc/sudoers (עורכים רק עם visudo).",
      example: { code: "sudo apt update\nsudo -u postgres psql", caption: "הרצה כ-root, או כמשתמש מסוים (-u)." },
      keyPoints: [
        "מבקש את הסיסמה שלך, לא של root.",
        "`sudo -l` מציג מה מותר לך להריץ.",
        "לא כדאי sudo ל-npm או pip בתיקיית הבית — זה יוצר בלגן הרשאות.",
      ],
      related: [
        { name: "File permissions (chmod)", why: "מה sudo עוקף" },
        { name: "Principle of least privilege", why: "הרעיון שמאחוריו" },
        { name: "Environment variables", why: "sudo מאפס את רובם" },
      ],
      category: "cli-os",
    },
  },
  homebrew: {
    en: {
      summary:
        "Homebrew (brew) is the de-facto package manager for macOS (and Linux): it installs command-line tools and apps with one command.",
      why: "Instead of downloading installers by hand, you get versioned, upgradeable installs in a single place, without sudo.",
      how: 'Search, install, upgrade and remove packages from the terminal; GUI apps come as "casks".',
      example: {
        code: "brew install node\nbrew install --cask docker\nbrew upgrade",
        caption: "A CLI tool, a GUI app, and upgrading everything.",
      },
      keyPoints: [
        "Formulae = CLI packages; casks = GUI apps.",
        "`brew doctor` diagnoses a broken setup.",
        "A Brewfile (`brew bundle`) reproduces a machine setup.",
      ],
      related: [
        { name: "Package managers", why: "apt, dnf, winget — the same idea" },
        { name: "PATH", why: "Why installed tools are found" },
        { name: "sudo", why: "Why brew avoids it" },
      ],
      category: "cli-os",
    },
    he: {
      summary:
        "Homebrew (brew) הוא מנהל החבילות המקובל ב-macOS (וגם Linux): מתקין כלי command-line ואפליקציות בפקודה אחת.",
      why: "במקום להוריד installers ידנית — מקבלים התקנות עם גרסאות ושדרוגים במקום אחד, בלי sudo.",
      how: 'מחפשים, מתקינים, משדרגים ומסירים חבילות מהטרמינל; אפליקציות עם ממשק מגיעות כ-"casks".',
      example: {
        code: "brew install node\nbrew install --cask docker\nbrew upgrade",
        caption: "כלי CLI, אפליקציה, ושדרוג של הכול.",
      },
      keyPoints: [
        "Formulae = חבילות CLI; casks = אפליקציות GUI.",
        "`brew doctor` מאבחן התקנה תקולה.",
        "Brewfile (`brew bundle`) משחזר הגדרת מחשב.",
      ],
      related: [
        { name: "Package managers", why: "apt, dnf, winget — אותו רעיון" },
        { name: "PATH", why: "למה הכלים שהותקנו נמצאים" },
        { name: "sudo", why: "למה brew נמנע ממנו" },
      ],
      category: "cli-os",
    },
  },
  dns: {
    en: {
      summary: "DNS translates human names like example.com into IP addresses that computers connect to.",
      why: "Names stay stable while servers, IPs and providers change behind them.",
      how: "Your machine asks a resolver, which walks root → TLD → the domain's name servers, then caches the answer for its TTL.",
      example: {
        code: "dig +short example.com A\ndig example.com CNAME",
        caption: "Look up the IPv4 address and an alias record.",
      },
      keyPoints: [
        "Common records: A/AAAA (IP), CNAME (alias), MX (mail), TXT (verification).",
        "TTL controls caching — lower it before a migration.",
        '"It\'s always DNS": stale caches explain many "works for me, not for them" bugs.',
      ],
      related: [
        { name: "OSI model", why: "Where DNS sits" },
        { name: "TLS", why: "Certificates are issued for DNS names" },
        { name: "Load balancer", why: "DNS often points at one" },
      ],
      category: "networking",
    },
    he: {
      summary: "DNS מתרגם שמות כמו example.com לכתובות IP שהמחשב מתחבר אליהן.",
      why: "השמות נשארים יציבים בזמן שהשרתים, ה-IPs והספקים מתחלפים מאחוריהם.",
      how: "המחשב שואל resolver, שעובר root → TLD → ה-name servers של הדומיין, ושומר את התשובה ב-cache לפי ה-TTL.",
      example: { code: "dig +short example.com A\ndig example.com CNAME", caption: "בדיקת כתובת IPv4 ורשומת alias." },
      keyPoints: [
        "רשומות נפוצות: A/AAAA (IP), CNAME (alias), MX (מייל), TXT (אימות).",
        "TTL קובע את ה-caching — מורידים אותו לפני מעבר.",
        '"It\'s always DNS": cache ישן מסביר הרבה באגים של "אצלי עובד, אצלם לא".',
      ],
      related: [
        { name: "OSI model", why: "איפה DNS יושב" },
        { name: "TLS", why: "תעודות מונפקות לשמות DNS" },
        { name: "Load balancer", why: "DNS מצביע הרבה פעמים על אחד" },
      ],
      category: "networking",
    },
  },
  "ci-cd": {
    en: {
      summary:
        "CI/CD automates building, testing (CI) and releasing (CD) every change, so shipping is routine instead of an event.",
      why: "Small, frequent, automatically-checked changes break less often and are easier to roll back than big manual releases.",
      how: "A pipeline runs on every push/PR: install → lint → test → build; merges to main deploy automatically (or after one approval).",
      example: {
        code: "on: [pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci && npm test",
        caption: "A minimal GitHub Actions CI job.",
      },
      keyPoints: [
        "CI = merge often, verified by automated checks.",
        "Continuous delivery = always deployable; continuous deployment = deployed automatically.",
        "Keep the pipeline fast — slow CI gets skipped.",
      ],
      related: [
        { name: "Blue-green deployment", why: "Releasing without downtime" },
        { name: "Feature flags", why: "Deploy code before releasing it" },
        { name: "Build cache", why: "Faster pipelines" },
      ],
      category: "devops",
    },
    he: {
      summary: "CI/CD הופך build, בדיקות (CI) ושחרור (CD) של כל שינוי לאוטומטיים — כך ש-deploy הוא שגרה ולא אירוע.",
      why: "שינויים קטנים ותכופים שנבדקים אוטומטית נשברים פחות וקל יותר לבצע להם rollback מאשר releases ידניים גדולים.",
      how: "Pipeline רץ על כל push/PR: install → lint → test → build; merge ל-main עושה deploy אוטומטית (או אחרי אישור).",
      example: {
        code: "on: [pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci && npm test",
        caption: "CI job מינימלי ב-GitHub Actions.",
      },
      keyPoints: [
        "CI = מיזוג תכוף, מאומת בבדיקות אוטומטיות.",
        "Continuous delivery = תמיד מוכן ל-deploy; continuous deployment = deploy אוטומטי.",
        "שומרים על pipeline מהיר — CI איטי מדלגים עליו.",
      ],
      related: [
        { name: "Blue-green deployment", why: "שחרור בלי downtime" },
        { name: "Feature flags", why: "deploy לפני שחרור" },
        { name: "Build cache", why: "pipelines מהירים יותר" },
      ],
      category: "devops",
    },
  },
  "feature-based-structure": {
    en: {
      summary:
        "Feature-based structure organises code by product feature (billing/, auth/, search/) instead of by technical type (components/, services/).",
      why: "Everything for one feature lives together, so changes stay local, ownership is clear and features can be deleted cleanly.",
      how: "Each feature folder holds its UI, logic, data access and tests, and exposes a small public API; shared code goes in a thin shared/ or lib/.",
      example: {
        code: "src/features/\n  billing/  (ui, api, model, billing.test.ts)\n  auth/\nsrc/shared/  (ui kit, utils)",
        caption: "Features own their code; only truly shared pieces live outside.",
      },
      keyPoints: [
        "Avoid features importing each other's internals — go through an index/public API.",
        "Start simple; split a feature when it grows, not before.",
        "Fits well with Next.js route folders and domain-driven design.",
      ],
      related: [
        { name: "Separation of concerns", why: "The principle behind it" },
        { name: "Microservices vs monolith", why: "The same boundaries at system level" },
        { name: "Domain-driven design", why: "Finding good feature boundaries" },
      ],
      category: "architecture",
    },
    he: {
      summary:
        "Feature-based structure מארגן קוד לפי פיצ'ר במוצר (billing/, auth/, search/) במקום לפי סוג טכני (components/, services/).",
      why: "כל מה ששייך לפיצ'ר נמצא יחד — שינויים נשארים מקומיים, הבעלות ברורה, ואפשר למחוק פיצ'ר בנקיון.",
      how: "כל תיקיית פיצ'ר מכילה UI, לוגיקה, גישה לנתונים ובדיקות, וחושפת API ציבורי קטן; קוד משותף נכנס ל-shared/ או lib/ דק.",
      example: {
        code: "src/features/\n  billing/  (ui, api, model, billing.test.ts)\n  auth/\nsrc/shared/  (ui kit, utils)",
        caption: "כל פיצ'ר מחזיק את הקוד שלו; רק מה שבאמת משותף יושב בחוץ.",
      },
      keyPoints: [
        "פיצ'רים לא מייבאים קוד פנימי אחד של השני — רק דרך index/API ציבורי.",
        "מתחילים פשוט; מפצלים כשהפיצ'ר גדל, לא לפני.",
        "מתאים טוב לתיקיות ה-routes של Next.js ול-domain-driven design.",
      ],
      related: [
        { name: "Separation of concerns", why: "העיקרון שמאחור" },
        { name: "Microservices vs monolith", why: "אותם גבולות ברמת המערכת" },
        { name: "Domain-driven design", why: "איך מוצאים גבולות טובים" },
      ],
      category: "architecture",
    },
  },
  "star-method": {
    en: {
      summary: "STAR is a way to answer behavioral interview questions: Situation, Task, Action, Result.",
      why: 'It turns "tell me about a time…" into a short, concrete story the interviewer can evaluate — instead of general claims.',
      how: "Prepare 6–8 real stories in advance; spend most of the time on *your* actions and end with a measurable result and what you learned.",
      example: {
        code: "S: Checkout latency doubled after a release.\nT: I owned the fix before a sale weekend.\nA: Profiled, found an N+1 query, added an index + cache.\nR: p95 dropped from 1.8s to 300ms; sale ran clean.",
        caption: "A compact STAR answer.",
      },
      keyPoints: [
        'Say "I", not "we" — they are evaluating you.',
        "Quantify the result when you can.",
        "Have a story about a failure or conflict, too.",
      ],
      related: [
        { name: "Behavioral interview", why: "Where STAR is used" },
        { name: "Leadership Principles", why: "Amazon maps stories to them" },
      ],
      category: "company",
    },
    he: {
      summary: "STAR היא שיטה לענות על שאלות behavioral בראיון: Situation, Task, Action, Result.",
      why: 'היא הופכת את "ספר/י על פעם ש..." לסיפור קצר וקונקרטי שהמראיין יכול להעריך — במקום הצהרות כלליות.',
      how: "מכינים מראש 6–8 סיפורים אמיתיים; רוב הזמן מוקדש לפעולות *שלך*, ומסיימים בתוצאה מדידה ובמה שלמדת.",
      example: {
        code: "S: Checkout latency doubled after a release.\nT: I owned the fix before a sale weekend.\nA: Profiled, found an N+1 query, added an index + cache.\nR: p95 dropped from 1.8s to 300ms; sale ran clean.",
        caption: "תשובת STAR קומפקטית.",
      },
      keyPoints: [
        'אומרים "אני", לא "אנחנו" — בודקים אותך.',
        "מכמתים את התוצאה כשאפשר.",
        "כדאי להכין גם סיפור על כישלון או קונפליקט.",
      ],
      related: [
        { name: "Behavioral interview", why: "איפה משתמשים ב-STAR" },
        { name: "Leadership Principles", why: "באמזון ממפים סיפורים אליהם" },
      ],
      category: "company",
    },
  },
  "amazon~leadership-principles": {
    en: {
      summary:
        "Amazon's Leadership Principles are a published set of values (e.g. Customer Obsession, Ownership, Dive Deep) that Amazon says guide decisions and hiring.",
      why: "Interviews are commonly structured around them: each interviewer probes a few principles with behavioral questions.",
      how: "Read the official list, pick 1–2 real stories per principle, and tell them in STAR format with your own actions and results.",
      example: {
        code: '"Tell me about a time you disagreed with your manager."\n→ Have Backbone; Disagree and Commit',
        caption: "A typical question and the principle it usually maps to.",
      },
      keyPoints: [
        "The list changes occasionally — always check the official page.",
        'Expect follow-ups that dig into details ("what exactly did you do?").',
        "The same story can cover more than one principle.",
      ],
      related: [
        { name: "STAR method", why: "The expected answer format" },
        { name: "Bar Raiser", why: "The interviewer focused on the bar" },
        { name: "Working backwards", why: "A related Amazon practice" },
      ],
      category: "company",
    },
    he: {
      summary:
        "ה-Leadership Principles של אמזון הם רשימת ערכים מפורסמת (למשל Customer Obsession, Ownership, Dive Deep) שלפי אמזון מנחה החלטות וגיוס.",
      why: "הראיונות בנויים בדרך כלל סביבם: כל מראיין בודק כמה עקרונות עם שאלות behavioral.",
      how: "קוראים את הרשימה הרשמית, בוחרים 1–2 סיפורים אמיתיים לכל עיקרון, ומספרים אותם בפורמט STAR עם הפעולות והתוצאות שלך.",
      example: {
        code: '"Tell me about a time you disagreed with your manager."\n→ Have Backbone; Disagree and Commit',
        caption: "שאלה טיפוסית והעיקרון שהיא בדרך כלל ממופה אליו.",
      },
      keyPoints: [
        "הרשימה מתעדכנת מדי פעם — תמיד לבדוק בעמוד הרשמי.",
        'צפו לשאלות המשך שנכנסות לפרטים ("מה בדיוק עשית?").',
        "אותו סיפור יכול לכסות יותר מעיקרון אחד.",
      ],
      related: [
        { name: "STAR method", why: "פורמט התשובה המצופה" },
        { name: "Bar Raiser", why: "המראיין שאחראי על הרף" },
        { name: "Working backwards", why: "פרקטיקה קשורה באמזון" },
      ],
      category: "company",
    },
  },
};
// The same curated STAR overview serves company-scoped STAR concepts.
CURATED["amazon~star-method"] = CURATED["star-method"];

/** Curated overview for a concept slug (company slug "x~y" falls back to the plain "y" only for generic methods). */
export function curatedOverview(slug: string, locale: Locale): ConceptOverview | null {
  return CURATED[slug]?.[locale] ?? null;
}

/** Contextual suggestions for a roadmap skill, minus what the user already has. */
export function skillSuggestions(skillId: string, existingSlugs: Iterable<string> = []): string[] {
  const have = new Set(existingSlugs);
  return (SKILL_SUGGESTIONS[skillId] ?? []).filter((n) => !have.has(conceptSlug(n)));
}
