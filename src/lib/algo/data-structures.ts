import type { DataStructure } from "./types";

/** Data structure cheat sheet (original text). Costs are typical / average unless marked. */
export const DATA_STRUCTURES: DataStructure[] = [
  {
    id: "array",
    name: "Array / dynamic array",
    summary: {
      he: "רצף בזיכרון: גישה לפי אינדקס מיידית, הוספה בסוף זולה (amortized), הוספה באמצע יקרה.",
      en: "Contiguous memory: instant index access, cheap append (amortized), expensive insert in the middle.",
    },
    ops: [
      { op: "access a[i]", cost: "O(1)" },
      { op: "append / pop end", cost: "O(1) amortized" },
      { op: "insert / delete middle", cost: "O(n)" },
      { op: "search (unsorted)", cost: "O(n)" },
      { op: "search (sorted)", cost: "O(log n)" },
      { op: "sort", cost: "O(n log n)" },
    ],
    whenToUse: [
      { he: "ברירת מחדל: סריקות, אינדקסים, טבלאות DP", en: "Default choice: scans, indexing, DP tables" },
      { he: "two pointers / sliding window / prefix sums", en: "Two pointers / sliding window / prefix sums" },
    ],
    pitfalls: [
      {
        he: "מחיקה מתחילת מערך בלולאה היא O(n²) – להשתמש ב-deque",
        en: "Removing from the front in a loop is O(n²): use a deque",
      },
      {
        he: "מחרוזות immutable: שרשור בלולאה יוצר העתקים",
        en: "Immutable strings: concatenating in a loop makes copies",
      },
    ],
  },
  {
    id: "hash-map",
    name: "Hash map (dictionary)",
    summary: {
      he: "מפתח → ערך עם גישה ממוצעת O(1). הכלי הראשון כשצריך לזכור מה ראינו או לספור.",
      en: "Key → value with O(1) average access. The first tool when you need to remember what you've seen or to count.",
    },
    ops: [
      { op: "get / put / delete", cost: "O(1) avg, O(n) worst" },
      { op: "iterate", cost: "O(n)" },
      { op: "ordered keys", cost: "✗ (use a sorted map)" },
    ],
    whenToUse: [
      { he: "ספירות, אינדקס אחרון שבו ראינו ערך, קיבוץ", en: "Counts, last index a value was seen, grouping" },
      { he: "memo ל-DP top-down", en: "Memo for top-down DP" },
    ],
    pitfalls: [
      { he: "מפתחות שאינם hashable", en: "Unhashable keys" },
      { he: "סדר האיטרציה לא מובטח בכל שפה", en: "Iteration order isn't guaranteed in every language" },
    ],
  },
  {
    id: "hash-set",
    name: "Hash set",
    summary: {
      he: "אוסף בלי כפילויות עם בדיקת שייכות ב-O(1) ממוצע.",
      en: "A collection without duplicates and O(1) average membership checks.",
    },
    ops: [
      { op: "add / remove / contains", cost: "O(1) avg" },
      { op: "union / intersection", cost: "O(n + m)" },
    ],
    whenToUse: [{ he: "visited ב-BFS/DFS, זיהוי כפילויות", en: "Visited in BFS/DFS, duplicate detection" }],
    pitfalls: [{ he: "לא שומר סדר ולא ספירה", en: "Keeps neither order nor counts" }],
  },
  {
    id: "stack",
    name: "Stack (LIFO)",
    summary: {
      he: 'האחרון שנכנס יוצא ראשון. מייצג "מה עוד פתוח" – סוגריים, רקורסיה, undo.',
      en: 'Last in, first out. Represents "what is still open": brackets, recursion, undo.',
    },
    ops: [
      { op: "push / pop / peek", cost: "O(1)" },
      { op: "search", cost: "O(n)" },
    ],
    whenToUse: [
      {
        he: "התאמת סוגריים, ביטויים, DFS איטרטיבי, מחסנית מונוטונית",
        en: "Bracket matching, expressions, iterative DFS, monotonic stack",
      },
    ],
    pitfalls: [{ he: "pop ממחסנית ריקה", en: "Popping an empty stack" }],
  },
  {
    id: "queue",
    name: "Queue (FIFO)",
    summary: {
      he: "הראשון שנכנס יוצא ראשון. הבסיס של BFS ושל עיבוד לפי סדר הגעה.",
      en: "First in, first out. The backbone of BFS and of processing in arrival order.",
    },
    ops: [
      { op: "enqueue / dequeue", cost: "O(1)" },
      { op: "peek front", cost: "O(1)" },
    ],
    whenToUse: [{ he: "BFS, רמות בעץ, סימולציות", en: "BFS, tree levels, simulations" }],
    pitfalls: [{ he: "מימוש עם מערך ו-shift() הוא O(n) לפעולה", en: "An array with shift() is O(n) per dequeue" }],
  },
  {
    id: "deque",
    name: "Deque (double-ended queue)",
    summary: {
      he: "הוספה והוצאה משני הקצוות ב-O(1). מאפשר תור מונוטוני למקסימום בחלון.",
      en: "Push and pop at both ends in O(1). Enables a monotonic queue for window maximum.",
    },
    ops: [
      { op: "push/pop front & back", cost: "O(1)" },
      { op: "access by index", cost: "O(1)–O(n) (language-dependent)" },
    ],
    whenToUse: [{ he: "מקסימום/מינימום בחלון נע, 0-1 BFS", en: "Sliding-window max/min, 0-1 BFS" }],
    pitfalls: [
      { he: "לשמור אינדקסים כדי לדעת מתי איבר יצא מהחלון", en: "Keep indices to know when an element left the window" },
    ],
  },
  {
    id: "linked-list",
    name: "Linked list",
    summary: {
      he: "צמתים עם מצביע לבא (ולפעמים לקודם). הוספה/מחיקה ליד צומת ידוע ב-O(1), אבל אין גישה לפי אינדקס.",
      en: "Nodes with a pointer to the next (sometimes previous). O(1) insert/delete next to a known node, but no index access.",
    },
    ops: [
      { op: "access k-th", cost: "O(n)" },
      { op: "insert / delete at known node", cost: "O(1)" },
      { op: "search", cost: "O(n)" },
    ],
    whenToUse: [{ he: "LRU cache (יחד עם hash map), מיזוג רשימות", en: "LRU cache (with a hash map), merging lists" }],
    pitfalls: [
      { he: "לאבד את המצביע לבא לפני שמשנים אותו", en: "Losing the next pointer before you rewire it" },
      { he: "dummy node חוסך טיפול מיוחד בראש", en: "A dummy node saves special handling of the head" },
    ],
  },
  {
    id: "heap",
    name: "Heap / priority queue",
    summary: {
      he: 'עץ בינארי כמעט מלא שבו השורש הוא המינימום (או המקסימום). לא ממוין לגמרי – רק "הכי קטן" זמין מיד.',
      en: "An almost-complete binary tree whose root is the min (or max). Not fully sorted: only the smallest is available instantly.",
    },
    ops: [
      { op: "peek min", cost: "O(1)" },
      { op: "push / pop", cost: "O(log n)" },
      { op: "build from n items", cost: "O(n)" },
      { op: "search arbitrary", cost: "O(n)" },
    ],
    whenToUse: [
      {
        he: "top-K, מיזוג K רשימות, Dijkstra, תזמון, חציון בזרם",
        en: "Top-K, K-way merge, Dijkstra, scheduling, streaming median",
      },
    ],
    pitfalls: [
      {
        he: "שוויון עדיפויות: להוסיף מפתח שני כדי שההשוואה תעבוד",
        en: "Equal priorities: add a tie-breaker so comparisons work",
      },
    ],
  },
  {
    id: "sorted-map",
    name: "Balanced BST / sorted map",
    summary: {
      he: 'מפתחות ממוינים עם הוספה, מחיקה וחיפוש ב-O(log n), כולל "הקטן הבא שגדול מ-x".',
      en: 'Sorted keys with O(log n) insert, delete and search, including "the next key above x".',
    },
    ops: [
      { op: "insert / delete / find", cost: "O(log n)" },
      { op: "floor / ceiling / successor", cost: "O(log n)" },
      { op: "in-order iteration", cost: "O(n)" },
    ],
    whenToUse: [
      {
        he: "צריך גם סדר וגם עדכונים (לוח הזמנות, חלון ממוין)",
        en: "You need both order and updates (a booking calendar, a sorted window)",
      },
    ],
    pitfalls: [
      {
        he: "לא בכל שפה יש מבנה מובנה – לברר מה מותר בראיון",
        en: "Not every language has one built in: ask what's allowed",
      },
    ],
  },
  {
    id: "tree",
    name: "Binary tree / BST",
    summary: {
      he: "כל צומת עם עד שני ילדים. ב-BST: שמאל < צומת < ימין, ולכן in-order ממוין. גובה h קובע את העלות.",
      en: "Each node has up to two children. In a BST: left < node < right, so in-order is sorted. Height h drives the cost.",
    },
    ops: [
      { op: "traverse", cost: "O(n)" },
      { op: "BST search / insert", cost: "O(h): O(log n) balanced, O(n) skewed" },
    ],
    whenToUse: [{ he: "היררכיות, ביטויים, חיפוש בסדר", en: "Hierarchies, expressions, ordered search" }],
    pitfalls: [{ he: "להניח שהעץ מאוזן כשלא נאמר", en: "Assuming the tree is balanced when it wasn't stated" }],
  },
  {
    id: "trie",
    name: "Trie",
    summary: {
      he: "עץ תחיליות: כל צומת מייצג תו. מהיר לחיפוש תחיליות, יקר בזיכרון.",
      en: "Prefix tree: each node is a character. Fast prefix lookups, memory-hungry.",
    },
    ops: [
      { op: "insert / search word", cost: "O(L)" },
      { op: "startsWith", cost: "O(L)" },
    ],
    whenToUse: [{ he: "השלמה אוטומטית, הרבה מילים על לוח", en: "Autocomplete, many words on a board" }],
    pitfalls: [{ he: "לשכוח סימון סוף מילה", en: "Forgetting the end-of-word flag" }],
  },
  {
    id: "graph",
    name: "Graph (adjacency list)",
    summary: {
      he: "צמתים וקשתות, מכוון או לא, עם או בלי משקלים. רשימת שכנים חסכונית לגרפים דלילים.",
      en: "Nodes and edges, directed or not, weighted or not. An adjacency list is compact for sparse graphs.",
    },
    ops: [
      { op: "iterate neighbours", cost: "O(deg(v))" },
      { op: "BFS / DFS", cost: "O(V + E)" },
      { op: "edge exists? (list)", cost: "O(deg(v)); matrix: O(1) with O(V²) memory" },
    ],
    whenToUse: [
      {
        he: "קשרים, מפות, תלויות, מטריצות (כל תא צומת)",
        en: "Relationships, maps, dependencies, grids (each cell is a node)",
      },
    ],
    pitfalls: [
      { he: "בגרף לא מכוון להוסיף את הקשת בשני הכיוונים", en: "In an undirected graph, add the edge both ways" },
      {
        he: "גרף לא קשיר: להתחיל חיפוש מכל צומת שלא ביקרנו",
        en: "Disconnected graph: start a search from every unvisited node",
      },
    ],
  },
  {
    id: "union-find",
    name: "Union-Find (disjoint set)",
    summary: {
      he: "מערך parent שמחזיק קבוצות זרות. find + union כמעט ב-O(1) עם דחיסת מסלול ואיחוד לפי דרגה.",
      en: "A parent array holding disjoint groups. find + union in near-O(1) with path compression and union by rank.",
    },
    ops: [
      { op: "find / union", cost: "≈ O(α(n))" },
      { op: "count groups", cost: "O(1) if tracked" },
    ],
    whenToUse: [
      {
        he: "רכיבים דינמיים, זיהוי מעגל בגרף לא מכוון, Kruskal",
        en: "Dynamic components, cycle detection in undirected graphs, Kruskal",
      },
    ],
    pitfalls: [{ he: "לא תומך במחיקת קשתות", en: "Doesn't support deleting edges" }],
  },
];

export const DS_BY_ID = new Map(DATA_STRUCTURES.map((d) => [d.id, d]));
