import type { L, PatternId } from "./types";

/**
 * The fixed checklist: the questions to ask yourself every time you read a problem. Each answer
 * nudges some patterns up (or down) and carries the reason, so the guide can explain itself.
 * Original content (docs/problem-solving.md).
 */
export interface GuideOption {
  id: string;
  label: L;
  /** Pattern weight changes when this option is chosen. */
  weights: Partial<Record<PatternId, number>>;
  /** Why this answer points where it points (shown next to the candidates). */
  why: L;
}

export interface GuideQuestion {
  id: string;
  q: L;
  /** Short helper under the question. */
  hint: L;
  options: GuideOption[];
}

export const GUIDE: GuideQuestion[] = [
  {
    id: "input",
    q: { he: "איך נראה הקלט?", en: "What does the input look like?" },
    hint: {
      he: "מבנה הקלט מצמצם מיד את המשפחה: רשימה מקושרת, עץ וגרף מגיעים עם כלים משלהם.",
      en: "The input shape narrows the family right away: lists, trees and graphs come with their own tools.",
    },
    options: [
      {
        id: "array",
        label: { he: "מערך / מחרוזת", en: "Array / string" },
        weights: { "two-pointers": 1, "sliding-window": 1, "prefix-sums": 1, hashing: 1 },
        why: {
          he: "מערך או מחרוזת: מתחילים מסריקה ליניארית ומהכלים של מערכים",
          en: "Array or string: start from linear scans and array tools",
        },
      },
      {
        id: "linked",
        label: { he: "רשימה מקושרת", en: "Linked list" },
        weights: { "fast-slow": 4, "two-pointers": 1 },
        why: {
          he: "רשימה מקושרת: אין אינדקסים, ולכן מצביעים (fast/slow, dummy head)",
          en: "Linked list: no indices, so pointers (fast/slow, dummy head)",
        },
      },
      {
        id: "tree",
        label: { he: "עץ", en: "Tree" },
        weights: { "tree-traversal": 4 },
        why: {
          he: "עץ: כמעט תמיד DFS רקורסיבי או BFS לפי רמות",
          en: "Tree: almost always recursive DFS or level-order BFS",
        },
      },
      {
        id: "graph",
        label: { he: "גרף / מטריצה / מצבים", en: "Graph / grid / states" },
        weights: { "graph-traversal": 3, "union-find": 1, "topo-sort": 1, dijkstra: 1 },
        why: {
          he: "גרף או מטריצה: חיפוש בגרף (BFS/DFS) הוא נקודת הפתיחה",
          en: "Graph or grid: graph search (BFS/DFS) is the starting point",
        },
      },
      {
        id: "intervals",
        label: { he: "טווחים [start, end]", en: "Intervals [start, end]" },
        weights: { intervals: 4, greedy: 1, heap: 1 },
        why: {
          he: "טווחים: כמעט תמיד ממיינים לפי התחלה או סוף ואז סורקים",
          en: "Intervals: you almost always sort by start or end, then sweep",
        },
      },
      {
        id: "words",
        label: { he: "הרבה מילים / מילון", en: "Many words / a dictionary" },
        weights: { trie: 3, hashing: 1, backtracking: 1 },
        why: { he: "הרבה מילים ותחיליות: Trie או hash set", en: "Many words and prefixes: a trie or a hash set" },
      },
      {
        id: "number",
        label: { he: "מספר בודד / ביטים", en: "A single number / bits" },
        weights: { "bit-manipulation": 3, "binary-search": 1 },
        why: {
          he: "מספר בודד: מתמטיקה, ביטים, או חיפוש בינארי על התשובה",
          en: "A single number: math, bits, or binary search on the answer",
        },
      },
      {
        id: "stream",
        label: { he: "זרם נתונים / מבנה לתכנון", en: "A data stream / a class to design" },
        weights: { heap: 2, hashing: 2 },
        why: {
          he: "זרם או תכנון מבנה: לבחור מבנה נתונים לפי הפעולות שחייבות להיות מהירות",
          en: "Stream or design: choose the structure by which operations must be fast",
        },
      },
    ],
  },
  {
    id: "sorted",
    q: { he: "האם הקלט ממוין? ואם לא, מותר למיין?", en: "Is the input sorted? If not, may you sort it?" },
    hint: {
      he: "מיון עולה O(n log n) אבל פותח two pointers, חיפוש בינארי וסריקת טווחים.",
      en: "Sorting costs O(n log n) but unlocks two pointers, binary search and interval sweeps.",
    },
    options: [
      {
        id: "sorted",
        label: { he: "כן, ממוין", en: "Yes, sorted" },
        weights: { "binary-search": 3, "two-pointers": 3 },
        why: {
          he: "קלט ממוין: חיפוש בינארי או שני מצביעים מהקצוות",
          en: "Sorted input: binary search or two pointers from both ends",
        },
      },
      {
        id: "sortable",
        label: { he: "לא, אבל הסדר לא חשוב (אפשר למיין)", en: "No, but order doesn't matter (you can sort)" },
        weights: { "two-pointers": 2, intervals: 1, greedy: 1 },
        why: {
          he: "אפשר למיין בלי לאבד מידע: אחרי מיון, שני מצביעים או חמדנות",
          en: "Sorting loses nothing: after sorting, two pointers or greedy",
        },
      },
      {
        id: "no",
        label: { he: "לא, והסדר המקורי חשוב", en: "No, and the original order matters" },
        weights: { hashing: 2, "prefix-sums": 1, "monotonic-stack": 1, "sliding-window": 1 },
        why: {
          he: "הסדר חשוב ואסור למיין: hash map, prefix sums או מחסנית",
          en: "Order matters, no sorting: a hash map, prefix sums or a stack",
        },
      },
    ],
  },
  {
    id: "goal",
    q: { he: "מה בדיוק מבקשים?", en: "What exactly is asked?" },
    hint: {
      he: 'הניסוח של השאלה הוא הרמז הכי חזק. חפשו מילים כמו "רציף", "כל", "K", "בכמה דרכים", "מינימום צעדים".',
      en: 'The wording is the strongest hint. Look for "contiguous", "all", "K", "how many ways", "minimum steps".',
    },
    options: [
      {
        id: "contiguous",
        label: { he: "תת-מערך / תת-מחרוזת רציפים הכי טובים", en: "The best contiguous subarray / substring" },
        weights: { "sliding-window": 3, "prefix-sums": 2, "dp-1d": 1 },
        why: {
          he: '"רציף": חלון נע, או prefix sums אם התנאי לא מונוטוני',
          en: '"Contiguous": a sliding window, or prefix sums if the condition isn\'t monotonic',
        },
      },
      {
        id: "pair",
        label: { he: "זוג / שלישייה שמגיעים ליעד", en: "A pair / triplet that hits a target" },
        weights: { hashing: 3, "two-pointers": 2 },
        why: {
          he: "זוג ליעד: hash map של השלמות, או two pointers אחרי מיון",
          en: "Pair to target: a hash map of complements, or two pointers after sorting",
        },
      },
      {
        id: "topk",
        label: { he: "K הגדולים / הקטנים / האיבר ה-K / חציון", en: "K largest / smallest / the K-th / a median" },
        weights: { heap: 4 },
        why: { he: '"K" או חציון: ערימה בגודל K (או שתי ערימות)', en: '"K" or median: a size-K heap (or two heaps)' },
      },
      {
        id: "all",
        label: { he: "לרשום את כל הצירופים / התמורות / המסלולים", en: "List every combination / permutation / path" },
        weights: { backtracking: 5 },
        why: {
          he: '"כל האפשרויות": backtracking, כי צריך לייצר כל אחת',
          en: '"Every option": backtracking, because you must produce each one',
        },
      },
      {
        id: "count",
        label: { he: "בכמה דרכים (מספר, לא רשימה)", en: "How many ways (a number, not the list)" },
        weights: { "dp-1d": 3, "dp-2d": 2, knapsack: 2 },
        why: {
          he: "ספירת דרכים: DP, כי אותם תתי-מצבים חוזרים",
          en: "Counting ways: DP, because the same sub-states repeat",
        },
      },
      {
        id: "optimize",
        label: { he: "מינימום / מקסימום של עלות או ערך", en: "Minimum / maximum cost or value" },
        weights: { "dp-1d": 2, greedy: 2, knapsack: 1, "binary-search": 1 },
        why: {
          he: "אופטימיזציה: DP אם ההחלטות תלויות זו בזו, greedy אם יש בחירה מקומית בטוחה",
          en: "Optimisation: DP if decisions interact, greedy if a local choice is safe",
        },
      },
      {
        id: "shortest",
        label: { he: "המסלול הקצר / מספר הצעדים המינימלי", en: "Shortest path / fewest steps" },
        weights: { "graph-traversal": 3, dijkstra: 2 },
        why: { he: "מינימום צעדים: BFS (או Dijkstra עם משקלים)", en: "Fewest steps: BFS (or Dijkstra with weights)" },
      },
      {
        id: "connect",
        label: { he: "קשירות / קבוצות / מעגל", en: "Connectivity / groups / a cycle" },
        weights: { "union-find": 3, "graph-traversal": 2 },
        why: {
          he: "קבוצות וקשירות: Union-Find או DFS עם visited",
          en: "Groups and connectivity: Union-Find or DFS with visited",
        },
      },
      {
        id: "order",
        label: { he: "סדר שמכבד תלויות", en: "An order that respects dependencies" },
        weights: { "topo-sort": 5 },
        why: { he: "תלויות: מיון טופולוגי (וזיהוי מעגל)", en: "Dependencies: topological sort (and cycle detection)" },
      },
      {
        id: "next",
        label: { he: "האיבר הבא הגדול / הקטן, סוגריים, מבנה מקונן", en: "Next greater / smaller, brackets, nesting" },
        weights: { "monotonic-stack": 5 },
        why: {
          he: '"הבא שגדול ממני" או קינון: מחסנית (מונוטונית)',
          en: '"Next one bigger than me" or nesting: a (monotonic) stack',
        },
      },
      {
        id: "find",
        label: { he: "למצוא ערך / מיקום / האם קיים", en: "Find a value / position / whether it exists" },
        weights: { "binary-search": 2, hashing: 2 },
        why: { he: "חיפוש: בינארי אם ממוין, hash set אם לא", en: "Lookup: binary search if sorted, a hash set if not" },
      },
      {
        id: "prefix",
        label: { he: "מילים לפי תחילית", en: "Words by prefix" },
        weights: { trie: 4 },
        why: { he: "תחיליות: Trie", en: "Prefixes: a trie" },
      },
      {
        id: "single",
        label: { he: "האיבר היחיד שחריג / זוגיות", en: "The one odd element / parity" },
        weights: { "bit-manipulation": 3, hashing: 2 },
        why: {
          he: '"מופיע פעם אחת": XOR (או hash map אם מותר זיכרון)',
          en: '"Appears once": XOR (or a hash map if memory is allowed)',
        },
      },
    ],
  },
  {
    id: "size",
    q: { he: "כמה גדול n? (מה אומרים האילוצים)", en: "How big is n? (what do the constraints say)" },
    hint: {
      he: "האילוץ מסגיר את הסיבוכיות המצופה. בערך 10^8 פעולות פשוטות בשנייה.",
      en: "The constraint gives away the expected complexity. Roughly 10^8 simple operations per second.",
    },
    options: [
      {
        id: "tiny",
        label: { he: "n ≤ 12", en: "n ≤ 12" },
        weights: { backtracking: 3 },
        why: {
          he: "n ≤ 12: גם O(n!) עובר, אז backtracking מלא סביר",
          en: "n ≤ 12: even O(n!) fits, so full backtracking is fine",
        },
      },
      {
        id: "small",
        label: { he: "n ≤ 25", en: "n ≤ 25" },
        weights: { backtracking: 2, "bit-manipulation": 1 },
        why: { he: "n ≤ 25: O(2^n) עובר (תתי-קבוצות, bitmask)", en: "n ≤ 25: O(2^n) fits (subsets, bitmask)" },
      },
      {
        id: "medium",
        label: { he: "n ≤ 500", en: "n ≤ 500" },
        weights: { "dp-2d": 1 },
        why: { he: "n ≤ 500: עד O(n³), למשל DP על טווחים", en: "n ≤ 500: up to O(n³), e.g. interval DP" },
      },
      {
        id: "mid",
        label: { he: "n ≤ 5,000", en: "n ≤ 5,000" },
        weights: { "dp-1d": 1, "dp-2d": 1 },
        why: { he: "n ≤ 5,000: O(n²) עובר, DP ריבועי בסדר", en: "n ≤ 5,000: O(n²) fits, a quadratic DP is fine" },
      },
      {
        id: "large",
        label: { he: "n ≤ 10^5 – 10^6", en: "n ≤ 10^5 – 10^6" },
        weights: { "sliding-window": 1, "two-pointers": 1, hashing: 1, heap: 1, greedy: 1, "prefix-sums": 1 },
        why: {
          he: "n עד 10^6: צריך O(n) או O(n log n), בלי לולאה כפולה",
          en: "n up to 10^6: you need O(n) or O(n log n), no nested loop",
        },
      },
      {
        id: "huge",
        label: { he: "ערכים עד 10^9 ומעלה", en: "Values up to 10^9 or more" },
        weights: { "binary-search": 3 },
        why: {
          he: "ערכים עצומים: אי אפשר לעבור על כולם, לחפש בינארית על הערך",
          en: "Huge values: you can't try them all, binary search over the value",
        },
      },
    ],
  },
  {
    id: "overlap",
    q: {
      he: "אם הייתי כותב רקורסיה נאיבית, היא הייתה פותרת את אותו מצב שוב ושוב?",
      en: "Would a naive recursion solve the same state again and again?",
    },
    hint: {
      he: "תתי-בעיות שחוזרות = DP. בחירה מקומית שתמיד בטוחה = greedy.",
      en: "Repeating subproblems = DP. A local choice that is always safe = greedy.",
    },
    options: [
      {
        id: "overlap",
        label: { he: "כן, אותם מצבים חוזרים", en: "Yes, the same states repeat" },
        weights: { "dp-1d": 3, "dp-2d": 2, knapsack: 2, backtracking: -1 },
        why: {
          he: "מצבים חוזרים: לשמור תוצאות (memo / טבלת DP)",
          en: "Repeating states: store results (memo / DP table)",
        },
      },
      {
        id: "greedy",
        label: { he: "לא צריך: יש בחירה מקומית שנראית תמיד נכונה", en: "No need: a local choice always looks right" },
        weights: { greedy: 4 },
        why: {
          he: "בחירה מקומית בטוחה: greedy (לבדוק דוגמה נגדית)",
          en: "A safe local choice: greedy (look for a counter-example)",
        },
      },
      {
        id: "none",
        label: { he: "לא רלוונטי", en: "Not relevant" },
        weights: {},
        why: { he: "", en: "" },
      },
    ],
  },
  {
    id: "monotone",
    q: {
      he: 'יש בדיקת כן/לא על התשובה שמתהפכת פעם אחת? ("אם X עובד, כל X גדול יותר עובד")',
      en: 'Is there a yes/no check on the answer that flips once? ("if X works, any bigger X works")',
    },
    hint: {
      he: "קיבולת, מהירות, זמן, מרחק מינימלי: אם קל לבדוק ערך נתון, מחפשים עליו בינארית.",
      en: "Capacity, speed, time, minimal distance: if a given value is easy to check, binary search it.",
    },
    options: [
      {
        id: "yes",
        label: { he: "כן", en: "Yes" },
        weights: { "binary-search": 4 },
        why: { he: "פרדיקט מונוטוני: חיפוש בינארי על התשובה", en: "Monotonic predicate: binary search on the answer" },
      },
      { id: "no", label: { he: "לא", en: "No" }, weights: {}, why: { he: "", en: "" } },
    ],
  },
  {
    id: "negatives",
    q: {
      he: "בשאלת תת-מערך: יכולים להיות ערכים שליליים?",
      en: "For a subarray question: can values be negative?",
    },
    hint: {
      he: 'חלון נע עובד רק כשהרחבה "מחמירה" תמיד את התנאי. ערכים שליליים שוברים את זה.',
      en: "A sliding window only works when growing always pushes the condition one way. Negatives break that.",
    },
    options: [
      {
        id: "nonneg",
        label: { he: "לא, הכול אי-שלילי / ספירות", en: "No, all non-negative / counts" },
        weights: { "sliding-window": 3 },
        why: {
          he: "ערכים אי-שליליים: התנאי מונוטוני, חלון נע עובד",
          en: "Non-negative values: the condition is monotonic, a window works",
        },
      },
      {
        id: "neg",
        label: { he: "כן, יש שליליים", en: "Yes, negatives exist" },
        weights: { "prefix-sums": 3, hashing: 2, "sliding-window": -3 },
        why: {
          he: "שליליים: חלון נע נשבר, prefix sums + hash map",
          en: "Negatives: a window breaks, use prefix sums + a hash map",
        },
      },
      { id: "na", label: { he: "לא רלוונטי", en: "Not relevant" }, weights: {}, why: { he: "", en: "" } },
    ],
  },
  {
    id: "lookup",
    q: {
      he: 'צריך לענות מהר על "ראיתי כבר את X?" או "כמה פעמים?"',
      en: 'Do you need fast answers to "have I seen X?" or "how many times?"',
    },
    hint: {
      he: "זה הסימן הקלאסי ל-hash map: מחליפים לולאה פנימית בבדיקה של O(1).",
      en: "The classic hash map signal: replace an inner loop with an O(1) lookup.",
    },
    options: [
      {
        id: "yes",
        label: { he: "כן", en: "Yes" },
        weights: { hashing: 3 },
        why: { he: '"ראיתי את X?": hash map / set', en: '"Seen X?": a hash map / set' },
      },
      { id: "no", label: { he: "לא", en: "No" }, weights: {}, why: { he: "", en: "" } },
    ],
  },
  {
    id: "weights",
    q: { he: "בגרף: לקשתות יש משקלים שונים?", en: "In a graph: do edges have different weights?" },
    hint: {
      he: "בלי משקלים BFS נותן מסלול קצר. עם משקלים אי-שליליים צריך Dijkstra.",
      en: "Without weights BFS gives the shortest path. With non-negative weights you need Dijkstra.",
    },
    options: [
      {
        id: "unweighted",
        label: { he: "לא, כל צעד עולה אותו דבר", en: "No, every step costs the same" },
        weights: { "graph-traversal": 2 },
        why: { he: "צעדים שווים: BFS מספיק למסלול הקצר", en: "Equal steps: BFS is enough for the shortest path" },
      },
      {
        id: "weighted",
        label: { he: "כן, יש משקלים", en: "Yes, weighted" },
        weights: { dijkstra: 4, "graph-traversal": -1 },
        why: { he: "משקלים אי-שליליים: Dijkstra עם ערימה", en: "Non-negative weights: Dijkstra with a heap" },
      },
      { id: "na", label: { he: "אין גרף", en: "No graph" }, weights: {}, why: { he: "", en: "" } },
    ],
  },
  {
    id: "memory",
    q: { he: "דורשים זיכרון נוסף O(1) / in-place?", en: "Is O(1) extra memory / in-place required?" },
    hint: {
      he: "בלי זיכרון נוסף נשארים עם מצביעים, החלפות in-place וביטים.",
      en: "Without extra memory you're left with pointers, in-place swaps and bits.",
    },
    options: [
      {
        id: "yes",
        label: { he: "כן", en: "Yes" },
        weights: { "two-pointers": 2, "fast-slow": 2, "bit-manipulation": 2, hashing: -2 },
        why: { he: "O(1) זיכרון: מצביעים או ביטים, לא hash map", en: "O(1) memory: pointers or bits, not a hash map" },
      },
      { id: "no", label: { he: "לא", en: "No" }, weights: {}, why: { he: "", en: "" } },
    ],
  },
];

export const QUESTION_BY_ID = new Map(GUIDE.map((q) => [q.id, q]));

/** n → target complexity (rule of thumb: ~10^8 simple operations per second). */
export const COMPLEXITY_TABLE: { n: string; target: string; examples: L }[] = [
  { n: "n ≤ 10–12", target: "O(n!)", examples: { he: "כל התמורות", en: "All permutations" } },
  { n: "n ≤ 20–25", target: "O(2^n)", examples: { he: "כל תתי-הקבוצות, bitmask DP", en: "All subsets, bitmask DP" } },
  { n: "n ≤ 100", target: "O(n^4)", examples: { he: "ארבע לולאות, DP כבד", en: "Four loops, heavy DP" } },
  {
    n: "n ≤ 500",
    target: "O(n^3)",
    examples: { he: "DP על טווחים, Floyd–Warshall", en: "Interval DP, Floyd–Warshall" },
  },
  { n: "n ≤ 5,000", target: "O(n^2)", examples: { he: "DP ריבועי, כל הזוגות", en: "Quadratic DP, all pairs" } },
  {
    n: "n ≤ 10^5 – 10^6",
    target: "O(n log n) / O(n)",
    examples: { he: "מיון, ערימה, חלון נע, hash map", en: "Sorting, heap, sliding window, hash map" },
  },
  {
    n: "n or values ≥ 10^9",
    target: "O(log n) / O(1)",
    examples: { he: "חיפוש בינארי על ערך, מתמטיקה", en: "Binary search on a value, math" },
  },
];

export type GuideAnswers = Partial<Record<string, string>>;

/** Keep only known question/option ids. */
export function cleanAnswers(raw: unknown): GuideAnswers {
  const out: GuideAnswers = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const q = QUESTION_BY_ID.get(k);
    if (q && typeof v === "string" && q.options.some((o) => o.id === v)) out[k] = v;
  }
  return out;
}
