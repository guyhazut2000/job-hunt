/**
 * "How it's used in industry": curated, static, original content for every data structure
 * (data-structures.ts) and algorithm pattern (patterns.ts). No LLM involved.
 *
 * Each item has a few everyday situations with the real tools/systems where the idea shows up,
 * plus one EXAMPLE work story (clearly labelled as an example in the UI) to show the shape of a
 * good answer to "have you used this at work?". Example stories are illustrations, never the
 * user's facts.
 */
import type { L } from "./types";

export type StoryItemKind = "ds" | "pattern";

export interface IndustryUse {
  /** The everyday situation. */
  text: L;
  /** Tools / systems where it appears (technical names, shown LTR). */
  tools: string[];
}

export interface StoryFields {
  situation: string;
  built: string;
  why: string;
  result: string;
}

export interface IndustryEntry {
  uses: IndustryUse[];
  /** Example answer (illustration only; labelled "דוגמה" in the UI). */
  example: { he: StoryFields; en: StoryFields };
}

const u = (he: string, en: string, tools: string[]): IndustryUse => ({ text: { he, en }, tools });
const ex = (he: StoryFields, en: StoryFields) => ({ he, en });

export const DS_INDUSTRY: Record<string, IndustryEntry> = {
  array: {
    uses: [
      u(
        "באפרים ו-pagination: רשימת תוצאות שמגיעה מה-API ומוצגת בדף",
        "Buffers and pagination: a page of API results rendered in a list",
        ["REST APIs", "React lists"],
      ),
      u(
        "עיבוד נתונים בעמודות (columnar) – מערכים רציפים הם מה שהופך שאילתות אנליטיות למהירות",
        "Columnar data processing – contiguous arrays are what make analytics queries fast",
        ["Parquet", "ClickHouse", "NumPy", "Pandas"],
      ),
      u(
        "Ring buffer ללוגים ולמטריקות האחרונות בזיכרון קבוע",
        "Ring buffers for recent logs / metrics in fixed memory",
        ["Linux kernel", "Disruptor", "telemetry agents"],
      ),
      u(
        "Virtualized lists: מציגים רק את חלון האינדקסים שעל המסך",
        "Virtualized lists: render only the window of indexes on screen",
        ["react-window", "TanStack Virtual"],
      ),
    ],
    example: ex(
      {
        situation: "דשבורד שהציג 20 אלף שורות ונתקע בדפדפן",
        built: "רשימה וירטואלית שמרנדרת רק את השורות שעל המסך לפי אינדקס",
        why: "גישה לפי אינדקס ב-O(1) מאפשרת לחשב מיד איזה טווח להציג בלי לסרוק הכל",
        result: "זמן הטעינה ירד מכ-4 שניות לפחות מחצי שנייה",
      },
      {
        situation: "A dashboard rendering 20k rows froze the browser",
        built: "A virtualized list that renders only the rows on screen by index",
        why: "O(1) index access lets you compute the visible range instantly without scanning everything",
        result: "Load time dropped from ~4s to under 0.5s",
      },
    ),
  },
  "hash-map": {
    uses: [
      u("Cache לפי מפתח: תוצאת שאילתה או קריאת API לפי id", "Key-based caching: a query or API result by id", [
        "Redis",
        "Memcached",
        "in-memory Map",
      ]),
      u(
        "Deduplication: לזהות אירוע או הודעה שכבר עובדו (idempotency key)",
        "Deduplication: detect an event/message already processed (idempotency key)",
        ["Stripe idempotency keys", "Kafka consumers"],
      ),
      u("Rate limiting: מונה בקשות לכל משתמש / IP", "Rate limiting: a request counter per user / IP", [
        "Redis INCR",
        "API gateways",
        "nginx",
      ]),
      u(
        "Join בזיכרון: לקבץ רשומות לפי מפתח לפני מיזוג (hash join)",
        "In-memory joins: group records by key before merging (hash join)",
        ["PostgreSQL hash join", "Spark", "lodash groupBy"],
      ),
    ],
    example: ex(
      {
        situation: "Webhook של תשלומים הגיע לפעמים פעמיים ויצר חיובים כפולים",
        built: "בדיקת idempotency לפי event id ששמור ב-Redis עם TTL",
        why: "צריך בדיקת 'ראיתי כבר?' ב-O(1) לכל אירוע, בלי לסרוק טבלה",
        result: "החיובים הכפולים ירדו לאפס, והטיפול נשאר מתחת ל-5ms לאירוע",
      },
      {
        situation: "A payments webhook was sometimes delivered twice and created duplicate charges",
        built: "An idempotency check by event id stored in Redis with a TTL",
        why: "We needed an O(1) 'have I seen this?' check per event without scanning a table",
        result: "Duplicate charges went to zero, handling stayed under 5ms per event",
      },
    ),
  },
  "hash-set": {
    uses: [
      u(
        "רשימת חסימה / allow-list: לבדוק מהר אם משתמש, דומיין או IP ברשימה",
        "Block / allow lists: quickly check whether a user, domain or IP is listed",
        ["WAF rules", "feature flags", "Set in JS"],
      ),
      u("'כבר ביקרנו' בסורקים ו-crawlers", "'Already visited' in crawlers and graph walks", [
        "web crawlers",
        "dependency walkers",
      ]),
      u(
        "Bloom filter – גרסה הסתברותית שחוסכת זיכרון: 'בטוח לא קיים' לפני גישה לדיסק",
        "Bloom filters – a probabilistic set: 'definitely absent' before hitting disk",
        ["Cassandra", "RocksDB", "Chrome Safe Browsing"],
      ),
    ],
    example: ex(
      {
        situation: "ייבוא אנשי קשר מקובץ CSV יצר כפילויות",
        built: "נרמול של אימייל ובדיקה מול Set לפני הוספה",
        why: "בדיקת שייכות ב-O(1) לכל שורה, בלי מיון של כל הקובץ",
        result: "ייבוא של 50 אלף שורות בלי כפילויות, תוך שניות",
      },
      {
        situation: "Importing contacts from CSV produced duplicates",
        built: "Normalised the email and checked a Set before inserting",
        why: "O(1) membership per row, no need to sort the whole file",
        result: "50k-row imports with zero duplicates, in seconds",
      },
    ),
  },
  stack: {
    uses: [
      u("Undo / redo בעורכים", "Undo / redo in editors", ["VS Code", "Figma", "Google Docs"]),
      u("Call stack ו-stack traces בדיבאגינג", "The call stack and stack traces when debugging", [
        "V8",
        "JVM",
        "Sentry",
      ]),
      u(
        "Parsing: סוגריים, JSON, HTML ו-expression evaluators",
        "Parsing: brackets, JSON, HTML and expression evaluators",
        ["JSON.parse", "Babel", "template engines"],
      ),
      u("ניווט 'אחורה' בדפדפן ובאפליקציות מובייל", "Back navigation in browsers and mobile apps", [
        "History API",
        "React Navigation",
      ]),
    ],
    example: ex(
      {
        situation: "בעורך טפסים משתמשים איבדו שינויים ולא יכלו לבטל",
        built: "מחסנית undo/redo של פעולות עם מגבלת עומק",
        why: "הפעולה האחרונה היא זו שמבטלים ראשונה – בדיוק LIFO",
        result: "פניות התמיכה על 'איבדתי שינויים' כמעט נעלמו",
      },
      {
        situation: "Users of a form builder lost changes and couldn't undo",
        built: "An undo/redo stack of operations with a depth limit",
        why: "The last action is the first to undo – exactly LIFO",
        result: "'I lost my changes' support tickets nearly disappeared",
      },
    ),
  },
  queue: {
    uses: [
      u(
        "Job queues: שליחת מיילים, עיבוד תמונות וכל עבודה ברקע",
        "Job queues: emails, image processing and any background work",
        ["RabbitMQ", "BullMQ", "AWS SQS", "Celery"],
      ),
      u("Message brokers ו-event streaming בין שירותים", "Message brokers and event streaming between services", [
        "Kafka",
        "Google Pub/Sub",
      ]),
      u("Event loop: תור ה-callbacks בדפדפן וב-Node.js", "The event loop: the callback queue in browsers and Node.js", [
        "Node.js",
        "browsers",
      ]),
      u("BFS: תור הוא הלב של סריקה לפי שכבות", "BFS: a queue is the heart of a level-by-level walk", [
        "crawlers",
        "social graphs",
      ]),
    ],
    example: ex(
      {
        situation: "יצירת דוחות PDF בתוך הבקשה גרמה ל-timeouts",
        built: "העברתי את העבודה לתור BullMQ עם workers ו-retries",
        why: "תור מפריד בין קבלת הבקשה לעיבוד ושומר על סדר FIFO והוגנות",
        result: "ה-API עונה תוך 100ms, ושיעור הכשלונות ירד מ-8% לפחות מ-1%",
      },
      {
        situation: "Generating PDF reports inside the request caused timeouts",
        built: "Moved the work to a BullMQ queue with workers and retries",
        why: "A queue decouples accepting a request from processing it and keeps FIFO fairness",
        result: "The API answers in 100ms and failures dropped from 8% to under 1%",
      },
    ),
  },
  deque: {
    uses: [
      u(
        "Work stealing: כל worker לוקח מהקצה שלו וגונב מהקצה של אחר",
        "Work stealing: each worker pops its own end and steals from another's",
        ["Java ForkJoinPool", "Go scheduler", "Tokio"],
      ),
      u(
        "Sliding window של מטריקות: מכניסים בסוף ומוציאים מההתחלה",
        "Sliding metric windows: push at the back, evict from the front",
        ["Prometheus-style rate()", "monitoring agents"],
      ),
      u("היסטוריה מוגבלת: 'N הפעולות האחרונות'", "Bounded history: 'the last N actions'", [
        "shell history",
        "recently viewed items",
      ]),
    ],
    example: ex(
      {
        situation: "רצינו להציג 'נצפו לאחרונה' בלי לגדול לאינסוף",
        built: "Deque בגודל 20: מוסיפים מקדימה ומוציאים מאחור",
        why: "הוספה והוצאה משני הקצוות ב-O(1)",
        result: "התכונה עלתה בלי שאילתות נוספות ל-DB, וההקלקות על פריטים עלו ב-12%",
      },
      {
        situation: "We wanted 'recently viewed' without unbounded growth",
        built: "A size-20 deque: push to the front, drop from the back",
        why: "O(1) insert/remove at both ends",
        result: "Shipped with no extra DB queries; clicks on items rose 12%",
      },
    ),
  },
  "linked-list": {
    uses: [
      u("LRU cache: hash map + רשימה מקושרת כפולה", "LRU cache: hash map + doubly linked list", [
        "CDNs",
        "browser cache",
        "Redis eviction",
        "lru-cache",
      ]),
      u("Free lists ו-allocators בזיכרון", "Free lists and memory allocators", ["malloc", "OS kernels"]),
      u(
        "Blockchain ו-Git: כל רשומה מצביעה על הקודמת",
        "Blockchain and Git history: each record points to the previous one",
        ["Git commits", "append-only logs"],
      ),
      u("Playlists ו-carousels עם 'הבא' ו'הקודם'", "Playlists and carousels with next / previous", ["media players"]),
    ],
    example: ex(
      {
        situation: "שירות פנימי קרא את אותם פרופילים מה-DB שוב ושוב",
        built: "LRU cache בזיכרון עם 10 אלף רשומות (hash map + רשימה מקושרת)",
        why: "ה-map נותן גישה ב-O(1), והרשימה מאפשרת להזיז ל'הכי חדש' ולפנות את הישן ב-O(1)",
        result: "70% מהקריאות הוגשו מהזיכרון, והעומס על ה-DB ירד בחצי",
      },
      {
        situation: "An internal service read the same profiles from the DB over and over",
        built: "An in-memory LRU of 10k entries (hash map + linked list)",
        why: "The map gives O(1) lookup; the list moves to 'most recent' and evicts the oldest in O(1)",
        result: "70% hit rate, DB load halved",
      },
    ),
  },
  heap: {
    uses: [
      u("Top-K: המוצרים / השאילתות / השגיאות הנפוצים ביותר", "Top-K: most popular products / queries / errors", [
        "analytics pipelines",
        "Elasticsearch aggregations",
      ]),
      u(
        "Scheduling: משימה עם הזמן או העדיפות הקרובים ביותר",
        "Scheduling: the task with the nearest time or highest priority",
        ["cron schedulers", "OS schedulers", "setTimeout timers", "Kubernetes"],
      ),
      u("Priority queues בתורים: עבודות דחופות לפני השאר", "Priority queues: urgent jobs first", [
        "RabbitMQ priorities",
        "BullMQ priority",
      ]),
      u("מיזוג K רשימות ממוינות (logs, shards)", "Merging K sorted streams (logs, shards)", [
        "LSM compaction",
        "distributed sort",
      ]),
    ],
    example: ex(
      {
        situation: "רצינו להציג 'עשר השגיאות הנפוצות היום' מתוך מיליוני לוגים",
        built: "ספירה ב-hash map ואז min-heap בגודל 10",
        why: "Heap בגודל K נותן O(n log K) וזיכרון קטן, במקום למיין הכל",
        result: "הדוח רץ בשניות במקום דקות, והצוות תיקן קודם את מה שהכי כואב",
      },
      {
        situation: "We wanted 'top 10 errors today' out of millions of log lines",
        built: "Counted in a hash map, then a size-10 min-heap",
        why: "A size-K heap gives O(n log K) and little memory instead of sorting everything",
        result: "The report ran in seconds instead of minutes; the team fixed what hurt most first",
      },
    ),
  },
  "sorted-map": {
    uses: [
      u(
        "אינדקסים ב-DB הם B-trees: חיפוש לפי טווח ו-ORDER BY בלי מיון",
        "Database indexes are B-trees: range lookups and ORDER BY without sorting",
        ["PostgreSQL B-tree", "MySQL InnoDB", "MongoDB"],
      ),
      u("Sorted sets ל-leaderboards ולחלונות זמן", "Sorted sets for leaderboards and time windows", ["Redis ZSET"]),
      u("LSM trees ו-memtables במנועי אחסון", "LSM trees and memtables in storage engines", [
        "RocksDB",
        "Cassandra",
        "LevelDB",
      ]),
      u("Cursor pagination לפי מפתח ממוין", "Cursor pagination by a sorted key", ["GraphQL connections", "Stripe API"]),
    ],
    example: ex(
      {
        situation: "רשימת הזמנות לפי תאריך נטענה לאט בטבלה של מיליונים",
        built: "אינדקס מורכב (userId, createdAt) ו-cursor pagination",
        why: "B-tree שומר מפתחות ממוינים, אז קפיצה לטווח וקריאה לפי סדר הן O(log n)",
        result: "השאילתה ירדה מ-1.2 שניות ל-15ms",
      },
      {
        situation: "An orders-by-date list was slow on a table with millions of rows",
        built: "A composite index (userId, createdAt) and cursor pagination",
        why: "A B-tree keeps keys sorted, so seeking to a range and reading in order is O(log n)",
        result: "The query went from 1.2s to 15ms",
      },
    ),
  },
  tree: {
    uses: [
      u("DOM ו-Virtual DOM: כל ממשק הוא עץ", "The DOM and virtual DOM: every UI is a tree", ["React", "browsers"]),
      u(
        "AST: קומפיילרים, linters ו-formatters עובדים על עצים",
        "ASTs: compilers, linters and formatters operate on trees",
        ["TypeScript", "ESLint", "Prettier", "Babel"],
      ),
      u(
        "מערכות קבצים, תפריטים, הרשאות היררכיות ומבנה ארגוני",
        "File systems, menus, hierarchical permissions and org charts",
        ["S3 prefixes", "IAM"],
      ),
      u("Merkle trees לזיהוי הבדלים מהר", "Merkle trees to detect differences quickly", [
        "Git",
        "DynamoDB anti-entropy",
        "IPFS",
      ]),
    ],
    example: ex(
      {
        situation: "תפריט קטגוריות בחנות היה טבלה שטוחה שקשה לתחזק",
        built: "מבנה עץ עם parentId ופונקציה רקורסיבית שבונה את התפריט",
        why: "קטגוריות הן היררכיה טבעית, ועץ מאפשר מעבר DFS להצגה ולחישוב breadcrumbs",
        result: "הוספת קטגוריה הפכה משינוי קוד לשינוי נתונים בלבד",
      },
      {
        situation: "A store's category menu was a flat table that was hard to maintain",
        built: "A tree with parentId and a recursive builder for the menu",
        why: "Categories are a natural hierarchy; a tree gives DFS for rendering and breadcrumbs",
        result: "Adding a category became a data change instead of a code change",
      },
    ),
  },
  trie: {
    uses: [
      u("Autocomplete ותיבת חיפוש", "Autocomplete and search boxes", [
        "Elasticsearch completion suggester",
        "search-as-you-type",
      ]),
      u("Routing: התאמת prefix של URL ב-routers", "Routing: URL prefix matching in routers", [
        "find-my-way (Fastify)",
        "httprouter (Go)",
      ]),
      u("ניתוב IP: התאמת הקידומת הארוכה ביותר (longest prefix match)", "IP routing – longest prefix match", [
        "routers",
        "CIDR tables",
      ]),
      u("בדיקת איות ומילונים", "Spell checking and dictionaries", ["IDE spell checkers", "keyboards"]),
    ],
    example: ex(
      {
        situation: "השלמה אוטומטית לשמות ערים הייתה איטית כי סיננו מערך בכל הקלדה",
        built: "Trie שנבנה פעם אחת עם 5 תוצאות מובילות לכל צומת",
        why: "חיפוש prefix עולה רק כאורך המילה ולא כמספר הערכים",
        result: "התגובה ירדה מ-80ms לפחות מ-2ms בכל הקלדה",
      },
      {
        situation: "City autocomplete was slow because we filtered an array on every keystroke",
        built: "A trie built once, with the top 5 results cached per node",
        why: "Prefix lookup costs the length of the word, not the number of entries",
        result: "Per-keystroke latency dropped from 80ms to under 2ms",
      },
    ),
  },
  graph: {
    uses: [
      u(
        "Dependency resolution: npm, build systems ו-CI pipelines",
        "Dependency resolution: npm, build systems and CI pipelines",
        ["npm", "Bazel", "Turborepo", "GitHub Actions needs"],
      ),
      u("ניווט ומפות: הדרך הקצרה ביותר", "Navigation and maps: shortest paths", ["Google Maps", "Waze", "OSRM"]),
      u("רשתות חברתיות והמלצות: 'אנשים שאולי אתה מכיר'", "Social networks and recommendations: 'people you may know'", [
        "LinkedIn",
        "Neo4j",
      ]),
      u("Microservices: מפת קריאות בין שירותים ו-tracing", "Microservices: service call graphs and tracing", [
        "Jaeger",
        "OpenTelemetry",
      ]),
    ],
    example: ex(
      {
        situation: "ב-monorepo כל שינוי הריץ את כל הבדיקות, 40 דקות",
        built: "גרף תלויות בין חבילות ו-BFS מהחבילות ששונו כדי למצוא את המושפעות",
        why: "התלויות הן גרף מכוון, ו-BFS מוצא בדיוק את מה שנוגע לשינוי",
        result: "זמן ה-CI הממוצע ירד ל-9 דקות",
      },
      {
        situation: "In a monorepo every change ran all tests – 40 minutes",
        built: "A package dependency graph and BFS from changed packages to find affected ones",
        why: "Dependencies form a directed graph; BFS finds exactly what the change touches",
        result: "Average CI time dropped to 9 minutes",
      },
    ),
  },
  "union-find": {
    uses: [
      u(
        "Identity resolution: לאחד חשבונות / רשומות שהם אותו אדם",
        "Identity resolution: merge accounts / records that are the same person",
        ["CRM dedup", "fraud detection"],
      ),
      u("Connected components ברשתות ובתמונות", "Connected components in networks and images", [
        "network monitoring",
        "OpenCV labeling",
      ]),
      u("Kruskal: פריסת רשת / כבלים בעלות מינימלית", "Kruskal: minimum-cost network / cable layout", [
        "network design",
        "clustering",
      ]),
    ],
    example: ex(
      {
        situation: "ב-CRM אותו לקוח הופיע כמה פעמים עם מייל או טלפון שונים",
        built: "Union-Find שמאחד רשומות שחולקות מייל או טלפון",
        why: "קשרים עקיפים (A↔B, B↔C) מתאחדים כמעט ב-O(1) לפעולה",
        result: "אוחדו 18% מהרשומות, והדיוור הכפול נפסק",
      },
      {
        situation: "In a CRM the same customer appeared several times with different emails or phones",
        built: "Union-Find merging records that share an email or a phone",
        why: "Transitive links (A↔B, B↔C) merge in near O(1) per operation",
        result: "18% of records merged and duplicate mailings stopped",
      },
    ),
  },
};

export const PATTERN_INDUSTRY: Record<string, IndustryEntry> = {
  "two-pointers": {
    uses: [
      u(
        "Merge של שתי רשימות ממוינות: merge join ב-DB, מיזוג קבצי לוג",
        "Merging two sorted lists: DB merge join, merging log files",
        ["PostgreSQL merge join", "git merge-base", "sort -m"],
      ),
      u(
        "Diff בין שתי גרסאות ממוינות של נתונים (מה נוסף / נמחק)",
        "Diffing two sorted snapshots (what was added / removed)",
        ["sync jobs", "rsync-like tools"],
      ),
      u("Deduplication במקום על מערך ממוין", "In-place dedup on a sorted array", ["ETL pipelines"]),
    ],
    example: ex(
      {
        situation: "סנכרון לילי בין קטלוג ספק לקטלוג שלנו לקח שעות",
        built: "מיון שני הקבצים לפי SKU והשוואה עם שני מצביעים",
        why: "מעבר אחד על שני הצדדים ב-O(n+m) במקום לחפש כל פריט בנפרד",
        result: "הסנכרון ירד משעתיים ל-6 דקות",
      },
      {
        situation: "A nightly sync between a supplier catalog and ours took hours",
        built: "Sorted both files by SKU and compared them with two pointers",
        why: "One pass over both sides in O(n+m) instead of looking up each item",
        result: "The sync went from 2 hours to 6 minutes",
      },
    ),
  },
  "sliding-window": {
    uses: [
      u(
        "Rate limiting בחלון זמן נע (sliding window log / counter)",
        "Rate limiting over a moving time window (sliding log / counter)",
        ["Redis", "Cloudflare", "API gateways"],
      ),
      u("מטריקות: ממוצע / p95 של 5 הדקות האחרונות", "Metrics: average / p95 over the last 5 minutes", [
        "Prometheus",
        "Grafana",
        "Datadog",
      ]),
      u(
        "Throttle ו-debounce באירועי UI (חיפוש תוך כדי הקלדה, scroll)",
        "Throttle and debounce for UI events (search-as-you-type, scroll)",
        ["lodash.debounce", "RxJS"],
      ),
      u("זיהוי אנומליות ו-streaming analytics", "Anomaly detection and streaming analytics", [
        "Kafka Streams",
        "Flink windows",
      ]),
    ],
    example: ex(
      {
        situation: "בוט אחד הציף את ה-API ופגע בכל הלקוחות",
        built: "Rate limiter של sliding window ב-Redis: 100 בקשות לדקה לכל מפתח",
        why: "חלון נע מונע את קפיצות הגבול של fixed window, ועולה O(1) לבקשה",
        result: "ה-API נשאר יציב, ורק המשתמש החריג קיבל 429",
      },
      {
        situation: "One bot flooded the API and hurt every customer",
        built: "A sliding-window rate limiter in Redis: 100 requests/minute per key",
        why: "A moving window avoids fixed-window edge bursts and costs O(1) per request",
        result: "The API stayed stable; only the offender got 429s",
      },
    ),
  },
  "prefix-sums": {
    uses: [
      u("דוחות 'מצטבר עד היום' וסכומי טווח מהירים", "'Running total' reports and fast range sums", [
        "SQL window functions SUM() OVER",
        "BI dashboards",
      ]),
      u("Summed-area tables בעיבוד תמונה", "Summed-area tables in image processing", ["OpenCV integral image"]),
      u("ספירת אירועים בטווח זמן בלי לסרוק את כולם", "Counting events in a time range without scanning them all", [
        "time-series rollups",
      ]),
    ],
    example: ex(
      {
        situation: "דשבורד הכנסות חישב סכום לכל טווח תאריכים מחדש",
        built: "טבלת סכומים מצטברים יומית, וחיסור של שני ערכים לכל טווח",
        why: "כל שאילתת טווח הופכת ל-O(1) אחרי הכנה אחת",
        result: "הגרפים נטענים מיד, והשאילתות הכבדות על ה-DB ירדו",
      },
      {
        situation: "A revenue dashboard recomputed a sum for every date range",
        built: "A daily cumulative-sum table; each range is one subtraction",
        why: "After one preprocessing pass every range query is O(1)",
        result: "Charts load instantly and heavy DB queries went away",
      },
    ),
  },
  hashing: {
    uses: [
      u("Caching ו-memoization של חישובים יקרים", "Caching and memoization of expensive work", [
        "Redis",
        "React useMemo",
        "HTTP ETag",
      ]),
      u("Consistent hashing לחלוקת מפתחות בין שרתים", "Consistent hashing to spread keys across servers", [
        "DynamoDB",
        "Cassandra",
        "load balancers",
      ]),
      u("Content hashing לזיהוי שינוי וכפילויות", "Content hashing to detect change and duplicates", [
        "Git SHA",
        "webpack contenthash",
        "S3 ETag",
      ]),
      u("ספירה וקיבוץ: כמה פעמים כל ערך מופיע", "Counting and grouping: how often each value appears", [
        "GROUP BY",
        "MapReduce",
      ]),
    ],
    example: ex(
      {
        situation: "סורק משרות עדכן כל משרה בכל ריצה גם בלי שינוי",
        built: "Hash של התוכן לכל משרה, ועדכון רק כשה-hash משתנה",
        why: "השוואת hash היא O(1) ומזהה שינוי בלי להשוות שדה-שדה",
        result: "הכתיבות ל-DB ירדו ב-90%",
      },
      {
        situation: "A job scraper rewrote every posting each run even without changes",
        built: "A content hash per posting; update only when the hash changes",
        why: "Comparing hashes is O(1) and detects change without field-by-field diffs",
        result: "DB writes dropped by 90%",
      },
    ),
  },
  "binary-search": {
    uses: [
      u("git bisect: למצוא את ה-commit ששבר", "git bisect: find the commit that broke things", ["git bisect"]),
      u("חיפוש באינדקס ממוין ו-B-trees", "Lookup in sorted indexes and B-trees", ["database indexes", "SSTables"]),
      u(
        "Capacity planning: מה העומס המקסימלי שעדיין עומד ב-SLA (binary search on the answer)",
        "Capacity planning: max load that still meets the SLA (binary search on the answer)",
        ["k6", "load tests"],
      ),
      u("Pagination וקפיצה לגרסה / לזמן מסוים בלוגים", "Pagination and seeking to a version / timestamp in logs", [
        "Kafka offsets by time",
        "log viewers",
      ]),
    ],
    example: ex(
      {
        situation: "רגרסיה בביצועים נכנסה אי-שם בין 300 commits",
        built: "git bisect עם סקריפט בדיקה אוטומטי",
        why: "חצייה של הטווח בכל צעד מוצאת את ה-commit בכ-9 צעדים במקום 300",
        result: "מצאנו את השורה הבעייתית תוך 20 דקות",
      },
      {
        situation: "A performance regression landed somewhere in 300 commits",
        built: "git bisect with an automated check script",
        why: "Halving the range each step finds the commit in ~9 steps instead of 300",
        result: "We found the offending line in 20 minutes",
      },
    ),
  },
  "monotonic-stack": {
    uses: [
      u(
        "ניתוח מחירים וסדרות זמן: 'מתי הערך הבא שגבוה מהיום'",
        "Price / time-series analysis: 'when is the next higher value'",
        ["trading tools", "analytics"],
      ),
      u("Layout: חישוב המלבן הגדול ביותר / skyline", "Layout: largest rectangle / skyline computations", [
        "charting",
        "UI layout engines",
      ]),
      u("עיבוד לוגים: למצוא את הקריאה האיטית הבאה אחרי כל קריאה", "Log processing: next slower call after each call", [
        "observability scripts",
      ]),
    ],
    example: ex(
      {
        situation: "רצינו להתריע כמה ימים עד שמחיר מוצר עולה שוב",
        built: "מחסנית מונוטונית על סדרת המחירים",
        why: "כל ערך נכנס ויוצא פעם אחת, אז זה O(n) במקום להשוות כל זוג",
        result: "החישוב רץ על כל הקטלוג בלילה בדקה אחת",
      },
      {
        situation: "We wanted to show how many days until a product's price rises again",
        built: "A monotonic stack over the price series",
        why: "Each value is pushed and popped once, so it's O(n) instead of comparing all pairs",
        result: "The nightly run over the whole catalog takes one minute",
      },
    ),
  },
  heap: {
    uses: [
      u("Top-K: טרנדים, הפריטים הנמכרים ביותר", "Top-K: trends, best sellers", ["Twitter trends", "analytics"]),
      u("Schedulers ו-timers: מה הדבר הבא שצריך לרוץ", "Schedulers and timers: what runs next", [
        "Node.js timers",
        "Kubernetes scheduler",
        "cron",
      ]),
      u("Priority queue בתורי עבודות", "Priority queues for jobs", ["BullMQ priority", "RabbitMQ priority"]),
      u("Median בזמן אמת (שני heaps)", "Running median (two heaps)", ["latency monitoring"]),
    ],
    example: ex(
      {
        situation: "תזכורות למשתמשים נשלחו באיחור כי סרקנו את כל הטבלה כל דקה",
        built: "Min-heap לפי זמן התזכורת הבא בתוך ה-worker",
        why: "תמיד צריך רק את התזכורת הקרובה ביותר, ו-heap נותן אותה ב-O(1) והוספה ב-O(log n)",
        result: "התזכורות יוצאות בזמן, והשאילתות הכבדות נעלמו",
      },
      {
        situation: "User reminders went out late because we scanned the whole table every minute",
        built: "A min-heap of next-reminder times inside the worker",
        why: "We only ever need the nearest reminder; a heap gives it in O(1) with O(log n) inserts",
        result: "Reminders fire on time and the heavy scans are gone",
      },
    ),
  },
  intervals: {
    uses: [
      u("יומנים: חפיפות פגישות וחיפוש זמן פנוי", "Calendars: overlapping meetings and finding free time", [
        "Google Calendar",
        "Calendly",
      ]),
      u("הזמנות: חדרים, טיסות ומשמרות", "Bookings: rooms, flights and shifts", [
        "booking systems",
        "Airbnb availability",
      ]),
      u("מיזוג טווחי IP / טווחי זמן בלוגים", "Merging IP ranges / time ranges in logs", [
        "firewall rules",
        "incident timelines",
      ]),
    ],
    example: ex(
      {
        situation: "מערכת הזמנת חדרי ישיבות אפשרה הזמנות כפולות",
        built: "בדיקת חפיפה על רשימת הזמנות ממוינת לפי שעת התחלה",
        why: "אחרי מיון מספיק להשוות כל הזמנה לשכנה שלה",
        result: "ההתנגשויות נעלמו, וגם הצגנו 'זמנים פנויים' מאותו מיון",
      },
      {
        situation: "A meeting-room booking system allowed double bookings",
        built: "Overlap checks on bookings sorted by start time",
        why: "After sorting you only compare each booking with its neighbour",
        result: "Conflicts disappeared, and the same sort gave us 'free slots'",
      },
    ),
  },
  "fast-slow": {
    uses: [
      u(
        "זיהוי לולאות: redirect loops, הפניות מעגליות בנתונים",
        "Cycle detection: redirect loops, circular references in data",
        ["URL shorteners", "workflow engines"],
      ),
      u("מציאת האמצע של stream / רשימה במעבר אחד", "Finding the middle of a stream / list in one pass", [
        "linked structures",
      ]),
      u("זיהוי מחזורים בגנרטורים מספריים (Floyd)", "Detecting cycles in number generators (Floyd)", [
        "PRNG testing",
        "Pollard's rho",
      ]),
    ],
    example: ex(
      {
        situation: "שרשרת הפניות בין קישורים קצרים נתקעה לפעמים בלולאה",
        built: "זיהוי מחזור עם מצביע איטי ומהיר לפני שמירת הפניה חדשה",
        why: "מוצא מחזור בזיכרון O(1) בלי לשמור את כל השרשרת",
        result: "אין יותר לולאות הפניה בפרודקשן",
      },
      {
        situation: "Redirect chains between short links sometimes looped forever",
        built: "Slow/fast pointer cycle detection before saving a new redirect",
        why: "Finds a cycle in O(1) memory without storing the chain",
        result: "No more redirect loops in production",
      },
    ),
  },
  "tree-traversal": {
    uses: [
      u(
        "מעבר על DOM / קומפוננטות: חיפוש אלמנטים, נגישות, רינדור",
        "Walking the DOM / component tree: queries, accessibility, rendering",
        ["querySelectorAll", "React reconciliation", "axe-core"],
      ),
      u("Codemods ו-linters: ביקור על כל צומת ב-AST", "Codemods and linters: visiting every AST node", [
        "ESLint rules",
        "jscodeshift",
        "Babel plugins",
      ]),
      u("חישוב גודל תיקיות, הרשאות יורשות ותפריטים", "Folder sizes, inherited permissions and menus", [
        "du",
        "IAM policies",
      ]),
      u("Serialization של מבנים מקוננים (JSON)", "Serializing nested structures (JSON)", [
        "JSON.stringify",
        "GraphQL resolvers",
      ]),
    ],
    example: ex(
      {
        situation: "רצינו לשנות API ישן בכ-400 קבצים",
        built: "Codemod שעובר על ה-AST ומחליף קריאות ישנות",
        why: "מעבר DFS על העץ מוצא כל קריאה בהקשר הנכון, בלי regex שביר",
        result: "המעבר נעשה ביום אחד בלי באגים, במקום שבועיים ידנית",
      },
      {
        situation: "We needed to migrate an old API across ~400 files",
        built: "A codemod that walks the AST and rewrites old calls",
        why: "DFS over the tree finds every call in context, no fragile regex",
        result: "Done in one day with no bugs instead of two weeks by hand",
      },
    ),
  },
  "graph-traversal": {
    uses: [
      u(
        "BFS לדרך הקצרה ביותר ברשת לא משוקללת: 'דרגות הפרדה'",
        "BFS for unweighted shortest paths: 'degrees of separation'",
        ["LinkedIn connections", "social graphs"],
      ),
      u("Web crawlers וסורקי קישורים שבורים", "Web crawlers and broken-link checkers", ["Googlebot", "linkinator"]),
      u("Garbage collection: mark מכל השורשים", "Garbage collection: mark from all roots", ["V8 GC", "JVM GC"]),
      u("Flood fill ו-connected components במפות ותמונות", "Flood fill and connected components in maps and images", [
        "paint bucket",
        "GIS",
      ]),
    ],
    example: ex(
      {
        situation: "האתר צבר קישורים שבורים אחרי שינוי מבנה",
        built: "סורק BFS מהעמוד הראשי עם Set של עמודים שביקרנו",
        why: "BFS עובר שכבה אחרי שכבה ומבטיח שכל עמוד נבדק פעם אחת",
        result: "מצאנו ותיקנו 230 קישורים שבורים, והסורק רץ עכשיו ב-CI",
      },
      {
        situation: "The site accumulated broken links after a restructure",
        built: "A BFS crawler from the home page with a visited Set",
        why: "BFS goes level by level and checks each page exactly once",
        result: "Found and fixed 230 broken links; the crawler now runs in CI",
      },
    ),
  },
  "topo-sort": {
    uses: [
      u("Build systems ו-CI: באיזה סדר לבנות חבילות", "Build systems and CI: which order to build packages", [
        "Turborepo",
        "Nx",
        "Bazel",
        "Make",
      ]),
      u("מיגרציות ו-ORMs: יצירת טבלאות לפי foreign keys", "Migrations and ORMs: create tables in foreign-key order", [
        "Prisma",
        "Terraform plans",
      ]),
      u("Workflow engines ו-DAGs של נתונים", "Workflow engines and data DAGs", [
        "Airflow",
        "dbt",
        "GitHub Actions needs",
      ]),
      u(
        "Package managers: סדר התקנה וזיהוי תלות מעגלית",
        "Package managers: install order and circular dependency detection",
        ["npm", "pip", "apt"],
      ),
    ],
    example: ex(
      {
        situation: "סקריפט ה-ETL הריץ שלבים בסדר ידני ושבר כשנוסף שלב חדש",
        built: "הגדרת תלויות לכל שלב ומיון טופולוגי שמחשב את סדר הריצה",
        why: "התלויות הן DAG, והמיון גם מזהה מעגלים לפני שמשהו רץ",
        result: "הוספת שלב הפכה לשורה אחת, ואפס כשלונות בגלל סדר",
      },
      {
        situation: "An ETL script ran steps in a hand-written order that broke when a step was added",
        built: "Declared dependencies per step and a topological sort for run order",
        why: "Dependencies are a DAG; the sort also catches cycles before anything runs",
        result: "Adding a step became one line; zero ordering failures",
      },
    ),
  },
  "union-find": {
    uses: [
      u("איחוד ישויות (entity resolution) ו-dedup", "Entity resolution and dedup", ["CRM", "fraud rings"]),
      u("Clustering ו-Kruskal MST", "Clustering and Kruskal MST", ["network design", "image segmentation"]),
      u("קישוריות ברשת: האם שני שרתים מחוברים", "Network connectivity: are two hosts connected", ["network tools"]),
    ],
    example: ex(
      {
        situation: "רשת של חשבונות הונאה השתמשה בכרטיסים ומכשירים משותפים",
        built: "Union-Find שמאחד חשבונות לפי כרטיס או device id משותף",
        why: "מוצא קבוצות מחוברות מהר גם כשהקשרים עקיפים",
        result: "זיהינו 12 רשתות שלמות במקום חשבונות בודדים",
      },
      {
        situation: "A fraud ring used shared cards and devices across accounts",
        built: "Union-Find merging accounts by shared card or device id",
        why: "Finds connected groups fast even through indirect links",
        result: "We caught 12 whole rings instead of single accounts",
      },
    ),
  },
  dijkstra: {
    uses: [
      u("ניווט: הדרך המהירה ביותר עם זמני נסיעה", "Navigation: fastest route with travel times", [
        "Google Maps",
        "Waze",
        "OSRM",
        "GraphHopper",
      ]),
      u("Routing ברשתות: OSPF מחשב מסלולים קצרים", "Network routing: OSPF computes shortest paths", ["OSPF", "IS-IS"]),
      u("לוגיסטיקה: עלות משלוח מינימלית בין מחסנים", "Logistics: cheapest shipping between warehouses", [
        "supply-chain planners",
      ]),
    ],
    example: ex(
      {
        situation: "רצינו להציג למשתמש זמן נסיעה בתחבורה ציבורית בין תחנות",
        built: "גרף תחנות עם משקל זמן ו-Dijkstra עם heap",
        why: "משקלים חיוביים שונים, ו-Dijkstra מבטיח את המסלול הקצר ביותר",
        result: "החישוב לוקח מילישניות לבקשה, והמשתמשים מסננים משרות לפי זמן נסיעה",
      },
      {
        situation: "We wanted to show public-transport travel time between stops",
        built: "A stop graph weighted by minutes and Dijkstra with a heap",
        why: "Positive, varying weights – Dijkstra guarantees the shortest path",
        result: "Milliseconds per request; users filter jobs by commute time",
      },
    ),
  },
  backtracking: {
    uses: [
      u("Schedulers עם אילוצים: שיבוץ משמרות, מערכת שעות", "Constraint schedulers: shift rostering, timetables", [
        "OptaPlanner",
        "constraint solvers",
      ]),
      u("Dependency solvers: בחירת גרסאות תואמות", "Dependency solvers: picking compatible versions", [
        "pip resolver",
        "Cargo",
        "apt",
      ]),
      u(
        "יצירת כל הקומבינציות לבדיקות (combinatorial testing)",
        "Generating combinations for tests (combinatorial testing)",
        ["test matrices", "property-based testing"],
      ),
      u("Regex engines ו-parsers עם חזרה לאחור", "Regex engines and backtracking parsers", [
        "PCRE",
        "JavaScript RegExp",
      ]),
    ],
    example: ex(
      {
        situation: "שיבוץ משמרות לצוות תמיכה נעשה ידנית ולקח יום בשבוע",
        built: "Backtracking שמשבץ לפי אילוצים וחותך ענפים לא חוקיים מוקדם",
        why: "צריך לבדוק צירופים אבל לוותר מהר על כל שיבוץ שכבר שובר אילוץ",
        result: "שיבוץ שבועי תוך שניות, ואפס הפרות של מנוחה מינימלית",
      },
      {
        situation: "Support shift rostering was manual and took a day a week",
        built: "Backtracking over constraints with early pruning of invalid branches",
        why: "We had to search combinations but abandon any branch that already breaks a rule",
        result: "A weekly roster in seconds, zero minimum-rest violations",
      },
    ),
  },
  "dp-1d": {
    uses: [
      u("תמחור ותכנון: מחיר מינימלי / מקסימלי לאורך צעדים", "Pricing and planning: min/max cost over steps", [
        "promotion engines",
        "billing",
      ]),
      u("Text wrapping ו-hyphenation (Knuth-Plass)", "Text wrapping and hyphenation (Knuth-Plass)", [
        "TeX",
        "typesetting engines",
      ]),
      u("Memoization של חישובים חוזרים ב-UI ובשרת", "Memoizing repeated computations in UI and server", [
        "React useMemo",
        "reselect",
      ]),
    ],
    example: ex(
      {
        situation: "מנוע מבצעים לא מצא את השילוב הזול ביותר של חבילות",
        built: "DP על כמות הפריטים: המחיר הזול ביותר לכל כמות",
        why: "כל פתרון לכמות n נבנה מפתרונות קטנים יותר שכבר חושבו",
        result: "הלקוחות קיבלו את המחיר הנכון, ותלונות על 'חיוב יקר מדי' ירדו",
      },
      {
        situation: "A promotions engine missed the cheapest bundle combination",
        built: "DP over item count: the cheapest price for each quantity",
        why: "Each answer for n builds on smaller answers already computed",
        result: "Customers got the right price; 'overcharged' complaints dropped",
      },
    ),
  },
  "dp-2d": {
    uses: [
      u("Diff בין טקסטים / קבצים (LCS)", "Diffing texts / files (LCS)", [
        "git diff",
        "GitHub PR diffs",
        "diff-match-patch",
      ]),
      u("Fuzzy search ובדיקת איות (edit distance)", "Fuzzy search and spell check (edit distance)", [
        "Elasticsearch fuzziness",
        "Fuse.js",
        "Postgres pg_trgm",
      ]),
      u("Sequence alignment בביואינפורמטיקה", "Sequence alignment in bioinformatics", ["BLAST", "Smith-Waterman"]),
    ],
    example: ex(
      {
        situation: "חיפוש שמות חברות נכשל על שגיאות כתיב קטנות",
        built: "Edit distance מוגבל (Levenshtein) לסינון מועמדים קרובים",
        why: "טבלת DP דו-ממדית מחשבת בדיוק כמה עריכות בין שתי מחרוזות",
        result: "חיפושים בלי תוצאות ירדו ב-35%",
      },
      {
        situation: "Company-name search failed on small typos",
        built: "Bounded edit distance (Levenshtein) to keep close candidates",
        why: "A 2D DP table computes exactly how many edits separate two strings",
        result: "Zero-result searches dropped 35%",
      },
    ),
  },
  knapsack: {
    uses: [
      u(
        "תקציב: בחירת פיצ'רים / קמפיינים עם הערך הגבוה ביותר בתקציב נתון",
        "Budgeting: pick features / campaigns with max value within a budget",
        ["roadmap planning", "ad bidding"],
      ),
      u("Bin packing: שיבוץ containers על שרתים", "Bin packing: placing containers on servers", [
        "Kubernetes scheduler",
        "Nomad",
      ]),
      u("בחירת קבצים לגיבוי / cache בגודל מוגבל", "Choosing files for a size-limited backup / cache", [
        "CDN prefetch",
        "mobile offline packs",
      ]),
    ],
    example: ex(
      {
        situation: "חבילת offline לאפליקציה הייתה מוגבלת ל-50MB",
        built: "Knapsack שבוחר אילו מפות / קבצים לכלול לפי שימוש ומשקל",
        why: "כל פריט נכנס או לא, וצריך מקסימום ערך במגבלת גודל",
        result: "כיסוי השימוש offline עלה מ-60% ל-85% באותו גודל",
      },
      {
        situation: "An app's offline pack was capped at 50MB",
        built: "A knapsack choosing which maps/files to include by usage and size",
        why: "Each item is in or out and we need max value under a size limit",
        result: "Offline usage coverage rose from 60% to 85% at the same size",
      },
    ),
  },
  greedy: {
    uses: [
      u("Load balancing: לשלוח לשרת הכי פחות עמוס", "Load balancing: send to the least-loaded server", [
        "nginx least_conn",
        "HAProxy",
      ]),
      u("דחיסה: קידוד Huffman", "Compression: Huffman coding", ["gzip", "DEFLATE", "JPEG"]),
      u("שיבוץ פגישות / משימות לפי זמן סיום", "Scheduling meetings / tasks by end time", ["calendar tools"]),
      u("עודף כסף, batching ו-autoscaling פשוט", "Making change, batching and simple autoscaling", [
        "payment systems",
        "HPA",
      ]),
    ],
    example: ex(
      {
        situation: "שרתי עיבוד וידאו היו עמוסים באופן לא אחיד",
        built: "חלוקה חמדנית: כל עבודה הולכת ל-worker עם התור הקצר ביותר",
        why: "החלטה מקומית פשוטה ב-O(log n) עם heap, טובה מספיק ויציבה",
        result: "זמן ההמתנה המקסימלי בתור ירד ב-40%",
      },
      {
        situation: "Video-processing servers were unevenly loaded",
        built: "Greedy dispatch: each job goes to the worker with the shortest queue",
        why: "A simple local choice in O(log n) with a heap – good enough and stable",
        result: "Max queue wait dropped 40%",
      },
    ),
  },
  "bit-manipulation": {
    uses: [
      u("Feature flags והרשאות כ-bitmask", "Feature flags and permissions as bitmasks", [
        "Discord permissions",
        "Unix chmod",
      ]),
      u("Bitmap indexes ו-bitsets מהירים", "Bitmap indexes and fast bitsets", [
        "Roaring Bitmaps",
        "Elasticsearch",
        "Redis SETBIT",
      ]),
      u("Hashing, checksums ו-Bloom filters", "Hashing, checksums and Bloom filters", ["CRC32", "xxHash"]),
      u("פרוטוקולי רשת: flags בכותרות", "Network protocols: header flags", ["TCP flags", "IP subnet masks"]),
    ],
    example: ex(
      {
        situation: "טבלת הרשאות עם עמודה לכל הרשאה הלכה והתנפחה",
        built: "Bitmask אחד לכל תפקיד ובדיקה עם AND",
        why: "בדיקת הרשאה היא פעולת ביט אחת, והוספת הרשאה לא דורשת מיגרציה",
        result: "בדיקות הרשאה מהירות יותר וקוד פשוט יותר ב-12 קבצים",
      },
      {
        situation: "A permissions table with a column per permission kept growing",
        built: "One bitmask per role checked with AND",
        why: "A permission check is a single bit operation; new permissions need no migration",
        result: "Faster checks and simpler code in 12 files",
      },
    ),
  },
  trie: {
    uses: [
      u("Autocomplete בתיבות חיפוש", "Search-box autocomplete", ["Algolia", "Elasticsearch suggesters"]),
      u("Routers: התאמת נתיבי URL", "Routers: matching URL paths", ["Fastify find-my-way", "Go httprouter"]),
      u("סינון מילים אסורות / מילון", "Profanity / dictionary filtering", ["moderation tools", "Aho-Corasick"]),
      u("חיפוש כתובת IP: התאמת הקידומת הארוכה ביותר", "IP lookup – longest prefix match", ["routers", "GeoIP"]),
    ],
    example: ex(
      {
        situation: "סינון מילים פוגעניות בצ'אט רץ לאט עם רשימה של אלפי ביטויים",
        built: "Trie (Aho-Corasick) שסורק כל הודעה פעם אחת",
        why: "מוצא את כל הביטויים במעבר אחד על ההודעה במקום לבדוק כל ביטוי",
        result: "הסינון ירד מ-30ms ל-1ms להודעה",
      },
      {
        situation: "Chat profanity filtering was slow with thousands of phrases",
        built: "A trie (Aho-Corasick) scanning each message once",
        why: "Finds every phrase in one pass instead of checking each phrase",
        result: "Filtering went from 30ms to 1ms per message",
      },
    ),
  },
};

export function industryFor(kind: StoryItemKind, id: string): IndustryEntry | undefined {
  return kind === "ds" ? DS_INDUSTRY[id] : PATTERN_INDUSTRY[id];
}
