import type { Pattern, PatternId } from "./types";

/**
 * Core problem-solving patterns. Original text (not copied from LeetCode, NeetCode, roadmap.sh or
 * any other site). Pseudocode is language-neutral on purpose: this section teaches the method, not
 * a specific language.
 */
export const PATTERNS: Pattern[] = [
  {
    id: "two-pointers",
    name: "Two pointers",
    family: "array",
    summary: {
      he: "שני אינדקסים שזזים על אותו מערך (מהקצוות פנימה, או אחד אחרי השני) כדי לוותר על לולאה כפולה. עובד כשהמבנה (בדרך כלל מיון) אומר לך איזה מצביע להזיז.",
      en: "Two indices moving over the same array (from both ends inward, or one chasing the other) to replace a nested loop. Works when the structure (usually sorting) tells you which pointer to move.",
    },
    signals: [
      { he: "הקלט ממוין, או שמותר למיין אותו", en: "The input is sorted, or you are allowed to sort it" },
      { he: "מחפשים זוג / שלישייה שסכומם שווה ליעד", en: "Find a pair / triplet whose sum hits a target" },
      { he: "פלינדרום, היפוך, או השוואה מהקצוות", en: "Palindromes, reversing, or comparing from both ends" },
      {
        he: "להסיר כפילויות או לסדר מחדש in-place בזיכרון O(1)",
        en: "Remove duplicates or partition in place with O(1) extra memory",
      },
    ],
    template: `left = 0, right = n - 1
while left < right:
    s = value(left, right)
    if s == target: record / return
    elif s < target: left += 1     # need bigger
    else: right -= 1               # need smaller`,
    time: "O(n) (+ O(n log n) if you sort first)",
    space: "O(1)",
    pitfalls: [
      {
        he: "מיון מאבד את האינדקסים המקוריים: אם צריך להחזיר אינדקסים, שמרו אותם לפני המיון",
        en: "Sorting loses the original indices: keep them first if the answer needs indices",
      },
      {
        he: "דילוג על כפילויות בשלישיות (3-sum) כדי לא להחזיר אותה תשובה פעמיים",
        en: "Skipping duplicates in triplets (3-sum) so the same answer is not returned twice",
      },
      { he: "תנאי עצירה left < right מול left <= right", en: "Stop condition left < right vs left <= right" },
    ],
    variants: [
      {
        he: "מהקצוות פנימה: זוגות במערך ממוין, פלינדרום, מיכל המים",
        en: "Opposite ends: pairs in a sorted array, palindromes, the water container",
      },
      {
        he: "קורא/כותב (read/write): מצביע אחד סורק והשני כותב את מה שנשאר",
        en: "Reader/writer: one pointer scans, the other writes what you keep",
      },
      { he: "שני מערכים: מיזוג של שתי רשימות ממוינות", en: "Two arrays: merging two sorted lists" },
    ],
    uses: ["array"],
    related: ["sliding-window", "binary-search", "fast-slow"],
  },
  {
    id: "sliding-window",
    name: "Sliding window",
    family: "array",
    summary: {
      he: "חלון רציף [left, right] שמתרחב ימינה ומתכווץ משמאל כשהתנאי נשבר. כל איבר נכנס ויוצא פעם אחת, ולכן O(n) במקום לבדוק כל תת-מערך.",
      en: "A contiguous window [left, right] that grows to the right and shrinks from the left when the condition breaks. Each element enters and leaves once, so O(n) instead of checking every subarray.",
    },
    signals: [
      { he: "תת-מערך / תת-מחרוזת רציפים (contiguous)", en: "Contiguous subarray / substring" },
      {
        he: "הארוך ביותר / הקצר ביותר / מקסימום בחלון בגודל k",
        en: "Longest / shortest / best over windows of size k",
      },
      {
        he: 'התנאי מונוטוני: הרחבת החלון רק "מחמירה" (או רק משפרת) אותו, למשל כשכל המספרים אי-שליליים',
        en: 'The condition is monotonic: growing the window only makes it "worse" (or only better), e.g. all numbers non-negative',
      },
      { he: '"לכל היותר k תווים שונים", "בלי חזרות"', en: '"At most k distinct", "without repeating characters"' },
    ],
    template: `left = 0, state = empty
for right in 0..n-1:
    add a[right] to state
    while state is invalid:
        remove a[left] from state
        left += 1
    best = max(best, right - left + 1)`,
    time: "O(n)",
    space: "O(k) for the window state (often a hash map of counts)",
    pitfalls: [
      {
        he: "מספרים שליליים שוברים את המונוטוניות: שם צריך prefix sums + hash map",
        en: "Negative numbers break monotonicity: use prefix sums + a hash map instead",
      },
      {
        he: "לעדכן את התשובה במקום הנכון: אחרי ההתכווצות (הארוך ביותר) או בתוך ה-while (הקצר ביותר)",
        en: "Update the answer in the right place: after shrinking (longest) or inside the while (shortest)",
      },
      {
        he: "לשכוח להוריד מונה לאפס / למחוק מפתח כשאיבר יוצא מהחלון",
        en: "Forgetting to decrement / delete a count when an element leaves the window",
      },
    ],
    variants: [
      { he: "חלון בגודל קבוע k", en: "Fixed size k" },
      { he: "חלון משתנה: הארוך ביותר שתקין / הקצר ביותר שתקין", en: "Variable size: longest valid / shortest valid" },
      { he: '"בדיוק K" = לכל היותר K פחות לכל היותר K-1', en: '"Exactly K" = atMost(K) − atMost(K−1)' },
    ],
    uses: ["array", "hash-map"],
    related: ["two-pointers", "prefix-sums", "hashing"],
  },
  {
    id: "prefix-sums",
    name: "Prefix sums",
    family: "array",
    summary: {
      he: "מחשבים מראש prefix[i] = סכום a[0..i-1], ואז הסכום של כל טווח הוא חיסור אחד. בשילוב hash map סופרים תת-מערכים עם סכום נתון, גם עם מספרים שליליים.",
      en: "Precompute prefix[i] = sum of a[0..i-1]; then any range sum is one subtraction. Combined with a hash map it counts subarrays with a given sum, negatives included.",
    },
    signals: [
      { he: "הרבה שאילתות על סכום של טווח", en: "Many range-sum queries" },
      { he: '"כמה תת-מערכים סכומם k" כשיש מספרים שליליים', en: '"How many subarrays sum to k" when negatives exist' },
      { he: 'מכפלה / סכום של "כל השאר חוץ ממני"', en: 'Product / sum of "everything except me"' },
      { he: "עדכוני טווח רבים (difference array)", en: "Many range updates (difference array)" },
    ],
    template: `prefix = 0, seen = {0: 1}
for x in a:
    prefix += x
    count += seen.get(prefix - k, 0)   # subarrays ending here with sum k
    seen[prefix] += 1`,
    time: "O(n) build, O(1) per query",
    space: "O(n)",
    pitfalls: [
      {
        he: "לשכוח את seen = {0: 1} (תת-מערך שמתחיל באינדקס 0)",
        en: "Forgetting seen = {0: 1} (subarrays that start at index 0)",
      },
      {
        he: "off-by-one: prefix באורך n+1 מפשט את החישוב",
        en: "Off-by-one: a prefix array of length n+1 keeps the math clean",
      },
      {
        he: "גלישה (overflow) בסכומים גדולים בשפות עם int מוגבל",
        en: "Overflow on big sums in languages with bounded ints",
      },
    ],
    variants: [
      { he: "דו-ממדי: סכום של מלבן במטריצה", en: "2D: sum of a rectangle in a matrix" },
      {
        he: "difference array: הוספה לטווח ב-O(1) ושחזור בסוף",
        en: "Difference array: O(1) range add, rebuild at the end",
      },
      { he: "prefix ו-suffix יחד (מכפלה חוץ מעצמי)", en: "Prefix and suffix together (product except self)" },
    ],
    uses: ["array", "hash-map"],
    related: ["hashing", "sliding-window"],
  },
  {
    id: "hashing",
    name: "Hash map / set",
    family: "array",
    summary: {
      he: 'לזכור מה כבר ראינו כדי לענות ב-O(1) על "ראיתי את X?" או "כמה פעמים?". הדרך הכי נפוצה להפוך O(n²) ל-O(n), במחיר זיכרון.',
      en: 'Remember what you\'ve seen so "have I seen X?" or "how many times?" is O(1). The most common way to turn O(n²) into O(n), paid for with memory.',
    },
    signals: [
      {
        he: '"האם קיים", "כפילויות", "השלמה ליעד" (target − x)',
        en: '"Does it exist", "duplicates", "complement to target" (target − x)',
      },
      { he: "ספירת תדירויות, אנגרמות, קיבוץ לפי מפתח", en: "Frequency counts, anagrams, grouping by a key" },
      { he: "הקלט לא ממוין ואסור/יקר למיין", en: "The input is unsorted and sorting is not allowed / too costly" },
    ],
    template: `seen = {}
for i, x in enumerate(a):
    if target - x in seen: return (seen[target - x], i)
    seen[x] = i`,
    time: "O(n) average",
    space: "O(n)",
    pitfalls: [
      {
        he: "מפתח שאינו hashable (רשימה): להפוך ל-tuple או למחרוזת חתימה",
        en: "Unhashable keys (lists): convert to a tuple or a signature string",
      },
      {
        he: "לבדוק לפני שמכניסים, כדי לא להתאים איבר לעצמו",
        en: "Check before inserting so an element doesn't pair with itself",
      },
      { he: "O(1) הוא ממוצע, לא מקרה גרוע", en: "O(1) is average, not worst case" },
    ],
    variants: [
      { he: "מונה תדירויות (counter)", en: "Frequency counter" },
      { he: "קיבוץ לפי חתימה (sorted string / count tuple)", en: "Group by signature (sorted string / count tuple)" },
      {
        he: "set לבדיקת התחלה של רצף (longest consecutive)",
        en: "Set to detect where a run starts (longest consecutive)",
      },
    ],
    uses: ["hash-map", "hash-set"],
    related: ["prefix-sums", "sliding-window"],
  },
  {
    id: "binary-search",
    name: "Binary search (incl. on the answer)",
    family: "search",
    summary: {
      he: 'חוצים את מרחב החיפוש בכל צעד. לא רק במערך ממוין: אם יש פרדיקט מונוטוני ("אם X עובד, כל X גדול יותר עובד"), מחפשים בינארית על התשובה עצמה.',
      en: 'Halve the search space each step. Not only on sorted arrays: when there is a monotonic predicate ("if X works, every bigger X works"), binary search the answer itself.',
    },
    signals: [
      { he: "מערך ממוין (גם אם מסובב) ונדרש O(log n)", en: "A sorted (even rotated) array and O(log n) is expected" },
      {
        he: '"המינימום ש..." / "המקסימום ש..." עם בדיקה קלה לערך נתון',
        en: '"The minimum X such that..." / "maximum X such that..." with an easy check for a given X',
      },
      {
        he: "טווח ערכים ענק (עד 10^9) אבל בדיקת ערך בודד היא O(n)",
        en: "Huge value range (up to 10^9) but checking one value is O(n)",
      },
    ],
    template: `lo, hi = smallest possible, largest possible
while lo < hi:
    mid = lo + (hi - lo) // 2
    if feasible(mid): hi = mid      # mid works, try smaller
    else: lo = mid + 1
return lo                           # first value that works`,
    time: "O(log range × cost of feasible)",
    space: "O(1)",
    pitfalls: [
      {
        he: "לולאה אינסופית: mid וההזזה של lo/hi חייבים להתאים (lo = mid + 1)",
        en: "Infinite loop: mid and the lo/hi update must agree (lo = mid + 1)",
      },
      { he: "גבולות התחלתיים שלא כוללים את התשובה", en: "Initial bounds that don't contain the answer" },
      { he: "הפרדיקט לא באמת מונוטוני", en: "The predicate isn't actually monotonic" },
    ],
    variants: [
      { he: "חיפוש ערך / גבול שמאלי / גבול ימני", en: "Exact value / left boundary / right boundary" },
      { he: "מערך ממוין מסובב: חצי אחד תמיד ממוין", en: "Rotated sorted array: one half is always sorted" },
      {
        he: "חיפוש על התשובה (קיבולת, מהירות, זמן מינימלי)",
        en: "Search on the answer (capacity, speed, minimal time)",
      },
    ],
    uses: ["array"],
    related: ["two-pointers", "greedy"],
  },
  {
    id: "monotonic-stack",
    name: "Stack / monotonic stack",
    family: "stack-heap",
    summary: {
      he: 'מחסנית שומרת "מה עוד פתוח". מחסנית מונוטונית (תמיד עולה או תמיד יורדת) עונה לכל איבר על "מי האיבר הבא שגדול/קטן ממני" ב-O(n) בסך הכול.',
      en: 'A stack keeps "what is still open". A monotonic stack (always increasing or decreasing) answers "who is the next greater/smaller element" for every element in O(n) total.',
    },
    signals: [
      { he: "סוגריים, ביטויים, ביטול/undo, מבנה מקונן", en: "Brackets, expressions, undo, nested structure" },
      {
        he: '"האיבר הבא הגדול/הקטן", "כמה ימים עד ש..."',
        en: '"Next greater / smaller element", "how many days until..."',
      },
      { he: "השטח הגדול ביותר בהיסטוגרמה / מלבנים", en: "Largest area in a histogram / rectangles" },
    ],
    template: `stack = []            # indices, values kept decreasing
for i in 0..n-1:
    while stack and a[stack.top] < a[i]:
        j = stack.pop()
        answer[j] = i     # i is j's next greater
    stack.push(i)`,
    time: "O(n): each index is pushed and popped once",
    space: "O(n)",
    pitfalls: [
      { he: "לשמור אינדקסים ולא ערכים כשצריך מרחק", en: "Store indices, not values, when you need distances" },
      { he: 'מה נשאר במחסנית בסוף (אין להם "הבא")', en: 'What\'s left on the stack at the end (they have no "next")' },
      { he: "< מול <= כשיש ערכים שווים", en: "< vs <= when values repeat" },
    ],
    variants: [
      { he: "מחסנית רגילה: התאמת סוגריים, חישוב ביטוי", en: "Plain stack: bracket matching, evaluating expressions" },
      {
        he: "מחסנית עולה / יורדת: next greater / previous smaller",
        en: "Increasing / decreasing stack: next greater / previous smaller",
      },
      { he: "תור מונוטוני (deque): מקסימום בחלון נע", en: "Monotonic deque: maximum in a sliding window" },
    ],
    uses: ["stack", "deque"],
    related: ["sliding-window"],
  },
  {
    id: "heap",
    name: "Heap / top-K",
    family: "stack-heap",
    summary: {
      he: "ערימה (priority queue) נותנת את הקטן/הגדול ביותר ב-O(log n). כשמבקשים K הכי גדולים/קרובים/תכופים, שומרים ערימה בגודל K במקום למיין הכול.",
      en: "A heap (priority queue) gives the smallest/largest in O(log n). For the K largest / closest / most frequent, keep a heap of size K instead of sorting everything.",
    },
    signals: [
      {
        he: '"K הגדולים / הקטנים / הקרובים / התכופים ביותר", "האיבר ה-K"',
        en: '"K largest / smallest / closest / most frequent", "K-th element"',
      },
      { he: "מיזוג K רשימות ממוינות", en: "Merge K sorted lists" },
      {
        he: "זרם נתונים (stream) וצריך מינימום/מקסימום/חציון בכל רגע",
        en: "A data stream and you need the min / max / median at any moment",
      },
      { he: 'תזמון: תמיד לטפל במשימה "הדחופה" ביותר', en: 'Scheduling: always handle the most "urgent" task next' },
    ],
    template: `heap = min-heap
for x in items:
    push(heap, x)
    if size(heap) > k: pop(heap)   # drop the smallest
# heap now holds the k largest; heap.top is the k-th largest`,
    time: "O(n log k)",
    space: "O(k)",
    pitfalls: [
      {
        he: "כדי לשמור K הגדולים צריך min-heap (ולהפך)",
        en: "To keep the K largest you need a min-heap (and vice versa)",
      },
      {
        he: "בשפות עם min-heap בלבד: להכניס ערך שלילי בשביל max-heap",
        en: "Languages with only a min-heap: push negatives for a max-heap",
      },
      {
        he: "אם K קרוב ל-n, מיון פשוט עשוי להיות פשוט באותה מידה",
        en: "If K is close to n, plain sorting may be just as good",
      },
    ],
    variants: [
      { he: "ערימה בגודל K", en: "Size-K heap" },
      { he: "שתי ערימות לחציון", en: "Two heaps for the median" },
      { he: "מיזוג K מקורות (ערימה של הראשים)", en: "K-way merge (a heap of heads)" },
    ],
    uses: ["heap", "hash-map"],
    related: ["greedy", "dijkstra", "intervals"],
  },
  {
    id: "intervals",
    name: "Intervals (sort + sweep)",
    family: "array",
    summary: {
      he: "ממיינים טווחים לפי התחלה (או סוף) ואז עוברים פעם אחת: ממזגים חפיפות, סופרים כמה פתוחים בו-זמנית, או בוחרים כמה שיותר שלא חופפים.",
      en: "Sort ranges by start (or end), then sweep once: merge overlaps, count how many are open at the same time, or pick as many non-overlapping ones as possible.",
    },
    signals: [
      {
        he: "זוגות [start, end]: פגישות, הזמנות, טווחי זמן",
        en: "[start, end] pairs: meetings, bookings, time ranges",
      },
      {
        he: '"חפיפה", "למזג", "כמה חדרים צריך", "כמה להסיר"',
        en: '"Overlap", "merge", "how many rooms", "how many to remove"',
      },
    ],
    template: `sort intervals by start
merged = [first]
for (s, e) in rest:
    if s <= merged.last.end: merged.last.end = max(merged.last.end, e)
    else: merged.append((s, e))`,
    time: "O(n log n)",
    space: "O(n)",
    pitfalls: [
      {
        he: "האם [1,2] ו-[2,3] חופפים? לברר עם המראיין",
        en: "Do [1,2] and [2,3] overlap? Clarify with the interviewer",
      },
      {
        he: "למיין לפי סוף כשבוחרים מקסימום טווחים שלא חופפים",
        en: "Sort by end when choosing the maximum number of non-overlapping ranges",
      },
      { he: "לעדכן end עם max ולא פשוט לדרוס", en: "Update end with max, don't just overwrite it" },
    ],
    variants: [
      { he: "מיזוג חפיפות", en: "Merge overlaps" },
      {
        he: "סריקת אירועים (+1 בהתחלה, −1 בסוף) למקסימום בו-זמניות",
        en: "Event sweep (+1 at start, −1 at end) for maximum concurrency",
      },
      { he: "בחירה חמדנית לפי סוף מוקדם", en: "Greedy pick by earliest end" },
    ],
    uses: ["array", "heap"],
    related: ["greedy", "heap", "prefix-sums"],
  },
  {
    id: "fast-slow",
    name: "Linked list: fast & slow pointers",
    family: "linked",
    summary: {
      he: "שני מצביעים ברשימה מקושרת, אחד זז צעד ואחד שניים. מוצאים מעגל, את האמצע, או את האיבר ה-k מהסוף, בלי זיכרון נוסף.",
      en: "Two pointers on a linked list, one moving one step and one moving two. Finds a cycle, the middle, or the k-th from the end, with no extra memory.",
    },
    signals: [
      { he: 'רשימה מקושרת + "מעגל", "אמצע", "k מהסוף"', en: 'Linked list + "cycle", "middle", "k-th from the end"' },
      { he: "דרישה לזיכרון O(1) ברשימה", en: "O(1) memory required on a list" },
      {
        he: 'מערך שבו הערכים הם "מצביעים" לאינדקסים (מציאת כפול)',
        en: 'An array whose values "point" to indices (finding the duplicate)',
      },
    ],
    template: `slow = fast = head
while fast and fast.next:
    slow = slow.next
    fast = fast.next.next
    if slow == fast: cycle found
# without a cycle, slow is now the middle`,
    time: "O(n)",
    space: "O(1)",
    pitfalls: [
      { he: "לבדוק fast וגם fast.next לפני קפיצה כפולה", en: "Check both fast and fast.next before the double step" },
      {
        he: "dummy head מונע מקרי קצה כשמוחקים את הראש",
        en: "A dummy head avoids edge cases when the head is removed",
      },
      {
        he: "אמצע ברשימה באורך זוגי: איזה מהשניים מבקשים?",
        en: "Middle of an even-length list: which of the two is wanted?",
      },
    ],
    variants: [
      { he: "זיהוי מעגל ומציאת תחילתו (Floyd)", en: "Detect a cycle and find where it starts (Floyd)" },
      { he: "פער קבוע של k צעדים: k מהסוף", en: "Fixed gap of k steps: k-th from the end" },
      { he: "היפוך חצי רשימה (פלינדרום ברשימה)", en: "Reverse half the list (palindrome list)" },
    ],
    uses: ["linked-list"],
    related: ["two-pointers"],
  },
  {
    id: "tree-traversal",
    name: "Trees: DFS / BFS",
    family: "tree",
    summary: {
      he: 'DFS (רקורסיה) כשהתשובה של צומת נבנית מהתשובות של הילדים: עומק, קוטר, סכומי מסלול, תקינות BST. BFS (תור) כשהשאלה היא לפי רמות או "הכי קרוב לשורש".',
      en: "DFS (recursion) when a node's answer is built from its children's answers: depth, diameter, path sums, BST validity. BFS (a queue) when the question is per level or \"closest to the root\".",
    },
    signals: [
      { he: "עץ בינארי / BST / N-ary", en: "Binary tree / BST / N-ary tree" },
      { he: '"לכל רמה", "מבט מהצד", "הרמה המינימלית" → BFS', en: '"Per level", "side view", "minimum depth" → BFS' },
      {
        he: '"עומק", "מסלול", "אב קדמון משותף", "האם תקין" → DFS',
        en: '"Depth", "path", "common ancestor", "is it valid" → DFS',
      },
    ],
    template: `def dfs(node):
    if node is null: return base
    left = dfs(node.left)
    right = dfs(node.right)
    return combine(node, left, right)

# BFS by level
queue = [root]
while queue:
    for _ in range(len(queue)): node = pop_front(queue); push children`,
    time: "O(n)",
    space: "O(h) for DFS (h = height), O(width) for BFS",
    pitfalls: [
      {
        he: "עץ לא מאוזן: רקורסיה בעומק n עלולה לגלוש (stack overflow)",
        en: "Unbalanced tree: recursion depth n may overflow the stack",
      },
      {
        he: "לבלבל בין מה שהפונקציה מחזירה למה שמעדכנים בצד (גלובלי)",
        en: "Mixing up what the function returns with what you update on the side (global best)",
      },
      { he: "ב-BST לנצל את הסדר (in-order ממוין)", en: "In a BST, use the order (in-order is sorted)" },
    ],
    variants: [
      { he: "pre / in / post order", en: "Pre / in / post order" },
      { he: "BFS לפי רמות", en: "Level-order BFS" },
      {
        he: "להחזיר כמה ערכים מהרקורסיה (גובה + תקינות)",
        en: "Return several values from the recursion (height + validity)",
      },
    ],
    uses: ["tree", "queue", "stack"],
    related: ["graph-traversal", "backtracking"],
  },
  {
    id: "graph-traversal",
    name: "Graphs & grids: BFS / DFS",
    family: "graph",
    summary: {
      he: "גרף הוא צמתים וקשתות; גם מטריצה היא גרף (כל תא מחובר לשכנים). DFS/BFS עם visited סופרים רכיבים ובודקים קשירות. BFS נותן מסלול קצר ביותר כשאין משקלים.",
      en: "A graph is nodes and edges; a grid is a graph too (each cell links to its neighbours). DFS/BFS with a visited set counts components and checks connectivity. BFS gives shortest paths when edges are unweighted.",
    },
    signals: [
      { he: "מטריצה של תאים (איים, אזורים, מבוך)", en: "A grid of cells (islands, regions, a maze)" },
      { he: '"מחובר", "רכיבים", "אפשר להגיע"', en: '"Connected", "components", "can you reach"' },
      { he: '"מספר הצעדים המינימלי" בלי משקלים → BFS', en: '"Minimum number of steps" without weights → BFS' },
      {
        he: "מצבים שעוברים ביניהם (מילה למילה, מנעול) = גרף מרומז",
        en: "States you move between (word to word, a lock) = an implicit graph",
      },
    ],
    template: `queue = [start]; visited = {start}; steps = 0
while queue:
    for _ in range(len(queue)):
        u = pop_front(queue)
        if u is goal: return steps
        for v in neighbours(u):
            if v not in visited: visited.add(v); push(queue, v)
    steps += 1`,
    time: "O(V + E) (grid: O(rows × cols))",
    space: "O(V)",
    pitfalls: [
      { he: "לסמן visited כשמכניסים לתור, לא כשמוציאים", en: "Mark visited when you enqueue, not when you dequeue" },
      { he: "יציאה מגבולות המטריצה", en: "Going out of grid bounds" },
      {
        he: "BFS מכמה מקורות בו-זמנית (multi-source) כשכולם מתחילים יחד",
        en: "Multi-source BFS when everything starts at once",
      },
    ],
    variants: [
      { he: "ספירת רכיבים (flood fill)", en: "Counting components (flood fill)" },
      { he: "BFS מכמה מקורות", en: "Multi-source BFS" },
      { he: "גרף מצבים מרומז", en: "Implicit state graph" },
    ],
    uses: ["graph", "queue", "hash-set"],
    related: ["tree-traversal", "union-find", "dijkstra", "topo-sort"],
  },
  {
    id: "topo-sort",
    name: "Topological sort",
    family: "graph",
    summary: {
      he: 'סדר של צמתים בגרף מכוון כך שכל קשת הולכת קדימה. מתאים לתלויות ("קודם A ואז B"). אם לא הצלחנו לסדר את כולם, יש מעגל.',
      en: "An ordering of a directed graph's nodes where every edge points forward. Fits dependencies (\"A before B\"). If you can't order them all, there's a cycle.",
    },
    signals: [
      { he: 'תלויות, דרישות קדם, "חייב לפני"', en: 'Dependencies, prerequisites, "must come before"' },
      { he: '"האם אפשר לסיים את כל הקורסים" = האם אין מעגל', en: '"Can you finish all courses" = is there no cycle' },
      { he: "סדר בנייה / קומפילציה / משימות", en: "Build / compile / task order" },
    ],
    template: `indegree[v] for every node
queue = nodes with indegree 0
order = []
while queue:
    u = pop_front(queue); order.append(u)
    for v in out(u):
        indegree[v] -= 1
        if indegree[v] == 0: push(queue, v)
has_cycle = len(order) < n`,
    time: "O(V + E)",
    space: "O(V + E)",
    pitfalls: [
      {
        he: 'כיוון הקשת: [a, b] = "b לפני a" או ההפך? לקרוא שוב',
        en: 'Edge direction: is [a, b] "b before a" or the opposite? Re-read',
      },
      { he: "צמתים בלי קשתות בכלל עדיין צריכים להופיע", en: "Nodes with no edges still need to appear" },
    ],
    variants: [
      { he: "Kahn (BFS עם indegree)", en: "Kahn (BFS with indegree)" },
      { he: "DFS עם שלושה צבעים לזיהוי מעגל", en: "DFS with three colours for cycle detection" },
    ],
    uses: ["graph", "queue"],
    related: ["graph-traversal"],
  },
  {
    id: "union-find",
    name: "Union-Find (DSU)",
    family: "graph",
    summary: {
      he: 'מבנה שמחזיק קבוצות זרות ומאחד אותן כמעט ב-O(1). מתאים כשקשתות מגיעות אחת-אחת ושואלים "האם a ו-b באותה קבוצה?" או "כמה קבוצות יש?".',
      en: 'A structure that keeps disjoint groups and merges them in near-O(1). Fits when edges arrive one by one and you ask "are a and b in the same group?" or "how many groups are there?".',
    },
    signals: [
      {
        he: '"כמה קבוצות / רכיבים", "מחוברים" עם קשתות שמתווספות',
        en: '"How many groups / components", "connected" with edges being added',
      },
      { he: '"איזו קשת יוצרת מעגל" בגרף לא מכוון', en: '"Which edge creates a cycle" in an undirected graph' },
      { he: "איחוד חשבונות / חברים / שוויונות (a == b)", en: "Merging accounts / friends / equalities (a == b)" },
    ],
    template: `parent[i] = i
def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]   # path halving
        x = parent[x]
    return x
def union(a, b):
    ra, rb = find(a), find(b)
    if ra == rb: return False          # already connected (cycle)
    attach smaller rank under larger; groups -= 1; return True`,
    time: "≈ O(α(n)) per operation (practically constant)",
    space: "O(n)",
    pitfalls: [
      {
        he: "לשכוח path compression / union by rank ולקבל O(n) לפעולה",
        en: "Forgetting path compression / union by rank and getting O(n) per op",
      },
      { he: "לא מתאים לגרף מכוון או למחיקת קשתות", en: "Not a fit for directed graphs or edge deletions" },
    ],
    variants: [
      { he: "ספירת רכיבים", en: "Count components" },
      { he: "זיהוי קשת מיותרת", en: "Detect the redundant edge" },
      { he: "Kruskal לעץ פורש מינימלי", en: "Kruskal for a minimum spanning tree" },
    ],
    uses: ["union-find"],
    related: ["graph-traversal"],
  },
  {
    id: "dijkstra",
    name: "Dijkstra (weighted shortest path)",
    family: "graph",
    summary: {
      he: "מסלול זול ביותר כשלקשתות יש משקלים אי-שליליים: ערימה שתמיד מוציאה את הצומת עם המרחק הקטן ביותר שידוע עד עכשיו.",
      en: "Cheapest path when edges have non-negative weights: a heap that always pops the node with the smallest known distance.",
    },
    signals: [
      {
        he: '"זמן / עלות / מאמץ מינימלי" ולקשתות יש משקלים שונים',
        en: '"Minimum time / cost / effort" and edges have different weights',
      },
      { he: "רשת, טיסות, עיכובים, מחיר מעבר בין תאים", en: "Networks, flights, delays, a cost to move between cells" },
      {
        he: "משקלים אי-שליליים (אם יש שליליים: Bellman-Ford)",
        en: "Non-negative weights (with negatives: Bellman-Ford)",
      },
    ],
    template: `dist = {source: 0}; heap = [(0, source)]
while heap:
    d, u = pop_min(heap)
    if d > dist[u]: continue          # stale entry
    for (v, w) in edges(u):
        if d + w < dist.get(v, inf):
            dist[v] = d + w; push(heap, (dist[v], v))`,
    time: "O((V + E) log V)",
    space: "O(V + E)",
    pitfalls: [
      { he: "לא לדלג על רשומות ישנות בערימה", en: "Not skipping stale heap entries" },
      { he: "להשתמש בדייקסטרה עם משקלים שליליים", en: "Using Dijkstra with negative weights" },
      { he: "כשכל המשקלים שווים, BFS פשוט מספיק", en: "When all weights are equal, plain BFS is enough" },
    ],
    variants: [
      { he: "עם מגבלת מספר עצירות (מצב = צומת + עצירות)", en: "With a limit on stops (state = node + stops)" },
      { he: "0-1 BFS כשמשקלים הם 0 או 1", en: "0-1 BFS when weights are 0 or 1" },
    ],
    uses: ["graph", "heap"],
    related: ["graph-traversal", "heap"],
  },
  {
    id: "backtracking",
    name: "Backtracking",
    family: "recursion",
    summary: {
      he: "בונים פתרון צעד-צעד, מנסים בחירה, ממשיכים ברקורסיה, ומבטלים אותה בחזרה. מתאים כשמבקשים את כל האפשרויות, וכש-n קטן מאוד.",
      en: "Build a solution step by step: try a choice, recurse, then undo it. Fits when you must list every option, and when n is very small.",
    },
    signals: [
      {
        he: '"כל הצירופים / התמורות / תתי-הקבוצות", "כל הדרכים"',
        en: '"All combinations / permutations / subsets", "all ways"',
      },
      { he: "n קטן מאוד (≤ 10–20): מותר אקספוננציאלי", en: "Very small n (≤ 10–20): exponential is allowed" },
      {
        he: "אילוצים לבדוק בדרך (N-Queens, סודוקו, חיפוש מילה בלוח)",
        en: "Constraints to check on the way (N-Queens, sudoku, word search on a board)",
      },
    ],
    template: `def backtrack(path, choices):
    if is_complete(path): results.append(copy(path)); return
    for c in choices:
        if not valid(path, c): continue    # prune early
        path.append(c)
        backtrack(path, next_choices(c))
        path.pop()                          # undo`,
    time: "Exponential (e.g. O(2^n), O(n!)) × cost per solution",
    space: "O(depth)",
    pitfalls: [
      { he: "להוסיף את path עצמו ולא העתק שלו", en: "Appending path itself instead of a copy" },
      {
        he: "כפילויות: למיין ולדלג על ערך זהה באותה רמה",
        en: "Duplicates: sort and skip an equal value at the same level",
      },
      {
        he: "אם מבקשים רק מספר דרכים (לא את הרשימה), כנראה DP",
        en: "If only the number of ways is asked (not the list), it's probably DP",
      },
    ],
    variants: [
      { he: "תתי-קבוצות (לקחת / לא לקחת)", en: "Subsets (take / skip)" },
      { he: "תמורות (used[])", en: "Permutations (used[])" },
      { he: "חיפוש על לוח עם סימון וביטול", en: "Board search with mark and unmark" },
    ],
    uses: ["array", "hash-set"],
    related: ["dp-1d", "tree-traversal", "trie"],
  },
  {
    id: "dp-1d",
    name: "Dynamic programming (1D)",
    family: "dp",
    summary: {
      he: "כשהבעיה מתפרקת לתתי-בעיות שחוזרות על עצמן: מגדירים dp[i] = התשובה לקידומת / למצב i, ומעבר מ-dp קודמים. סופרים דרכים, מינימום או מקסימום.",
      en: "When the problem splits into overlapping subproblems: define dp[i] = the answer for prefix / state i, with a transition from earlier dp values. Count ways, minimise or maximise.",
    },
    signals: [
      {
        he: '"בכמה דרכים", "מינימום / מקסימום" כשכל החלטה משפיעה על ההמשך',
        en: '"How many ways", "min / max" where each decision affects what follows',
      },
      {
        he: "רקורסיה נאיבית מחשבת את אותו מצב שוב ושוב",
        en: "A naive recursion computes the same state again and again",
      },
      { he: '"לא שני איברים סמוכים", מדרגות, פענוח מחרוזת', en: '"No two adjacent", stairs, decoding a string' },
      { he: "תת-סדרה (לא רציפה) הארוכה ביותר", en: "Longest (non-contiguous) subsequence" },
    ],
    template: `dp[0] = base
for i in 1..n:
    dp[i] = best over choices of (dp[previous state] + gain)
return dp[n]
# often only dp[i-1], dp[i-2] are needed → O(1) memory`,
    time: "O(n × transitions)",
    space: "O(n), often reducible to O(1)",
    pitfalls: [
      {
        he: 'הגדרת מצב לא מדויקת ("שמסתיים ב-i" מול "עד i")',
        en: 'A fuzzy state definition ("ends at i" vs "up to i")',
      },
      { he: "מקרי בסיס חסרים", en: "Missing base cases" },
      {
        he: "לנסות greedy כשהוא לא נכון: לחפש דוגמה נגדית",
        en: "Trying greedy where it fails: look for a counter-example",
      },
    ],
    variants: [
      { he: "top-down (רקורסיה + memo) או bottom-up (טבלה)", en: "Top-down (recursion + memo) or bottom-up (table)" },
      { he: "dp על קידומות של מחרוזת (פענוח, פירוק למילים)", en: "DP over string prefixes (decoding, word break)" },
    ],
    uses: ["array", "hash-map"],
    related: ["dp-2d", "knapsack", "greedy", "backtracking"],
  },
  {
    id: "dp-2d",
    name: "Dynamic programming (2D: grids & two strings)",
    family: "dp",
    summary: {
      he: "המצב צריך שני מספרים: מיקום במטריצה (שורה, עמודה) או אינדקס בכל אחת משתי מחרוזות. dp[i][j] נבנה מהשכנים שכבר חושבו.",
      en: "The state needs two numbers: a grid position (row, column) or an index into each of two strings. dp[i][j] is built from neighbours already computed.",
    },
    signals: [
      {
        he: 'שתי מחרוזות: "תת-סדרה משותפת", "מרחק עריכה", "התאמה"',
        en: 'Two strings: "common subsequence", "edit distance", "matching"',
      },
      {
        he: "מטריצה שבה זזים רק ימינה/למטה וסופרים דרכים או עלות",
        en: "A grid where you only move right/down and count paths or cost",
      },
      { he: "טווח i..j (פלינדרומים, חלוקה של טווח)", en: "A range i..j (palindromes, splitting a range)" },
    ],
    template: `dp = table (m+1) × (n+1) with base row / column
for i in 1..m:
    for j in 1..n:
        if a[i-1] == b[j-1]: dp[i][j] = dp[i-1][j-1] + 1
        else: dp[i][j] = max(dp[i-1][j], dp[i][j-1])
return dp[m][n]`,
    time: "O(m × n)",
    space: "O(m × n), often reducible to one row",
    pitfalls: [
      { he: "off-by-one עם שורת/עמודת בסיס ריקה", en: "Off-by-one with an empty base row / column" },
      { he: "סדר מילוי שלא מבטיח שהשכנים כבר חושבו", en: "A fill order that doesn't guarantee neighbours are ready" },
    ],
    variants: [
      { he: "מסלולים במטריצה", en: "Grid paths" },
      { he: "שתי מחרוזות (LCS, edit distance)", en: "Two strings (LCS, edit distance)" },
      { he: "DP על טווחים [i..j]", en: "Interval DP [i..j]" },
    ],
    uses: ["array"],
    related: ["dp-1d", "knapsack"],
  },
  {
    id: "knapsack",
    name: "Knapsack DP",
    family: "dp",
    summary: {
      he: "בוחרים פריטים תחת תקציב (משקל / סכום יעד). dp[s] = הכי טוב / כמה דרכים להגיע ל-s. 0/1: כל פריט פעם אחת (לולאה על s מלמעלה למטה). ללא הגבלה: אפשר לחזור על פריט.",
      en: "Pick items under a budget (weight / target sum). dp[s] = the best / number of ways to reach s. 0/1: each item once (loop s downward). Unbounded: items may repeat.",
    },
    signals: [
      {
        he: '"סכום יעד" מתוך פריטים, "מטבעות", "לחלק לשתי קבוצות שוות"',
        en: '"Target sum" from items, "coins", "split into two equal groups"',
      },
      {
        he: "סכום היעד קטן יחסית (עד ~10^4) כך שאפשר טבלה לפי סכום",
        en: "The target is fairly small (up to ~10^4), so a table by sum is affordable",
      },
    ],
    template: `dp = [inf] * (target + 1); dp[0] = 0
for coin in coins:                     # unbounded: s goes up
    for s in coin..target:
        dp[s] = min(dp[s], dp[s - coin] + 1)
# 0/1 variant: for s from target down to item`,
    time: "O(items × target)",
    space: "O(target)",
    pitfalls: [
      { he: "כיוון הלולאה על s קובע 0/1 מול ללא הגבלה", en: "The direction of the s loop decides 0/1 vs unbounded" },
      {
        he: 'סדר הלולאות משנה בין "צירופים" ל"תמורות" בספירת דרכים',
        en: "Loop order changes combinations vs permutations when counting ways",
      },
      {
        he: "greedy על מטבעות נכשל בערכים כמו [1, 3, 4] ליעד 6",
        en: "Greedy on coins fails for values like [1, 3, 4] with target 6",
      },
    ],
    variants: [
      { he: "0/1 knapsack (חלוקה שווה)", en: "0/1 knapsack (equal partition)" },
      { he: "unbounded (מטבעות)", en: "Unbounded (coins)" },
      { he: "ספירת דרכים מול מינימום פריטים", en: "Counting ways vs minimum items" },
    ],
    uses: ["array"],
    related: ["dp-1d", "dp-2d", "backtracking"],
  },
  {
    id: "greedy",
    name: "Greedy",
    family: "other",
    summary: {
      he: "בכל צעד לוקחים את הבחירה שנראית הכי טובה עכשיו ולא חוזרים אחורה. מהיר ופשוט, אבל צריך נימוק (או חוסר דוגמה נגדית) שהבחירה המקומית בטוחה.",
      en: "At each step take the choice that looks best now and never go back. Fast and simple, but you need an argument (or no counter-example) that the local choice is safe.",
    },
    signals: [
      {
        he: '"מינימום / מקסימום" כשיש סדר טבעי (סוף מוקדם, הכי רחוק שאפשר להגיע)',
        en: '"Min / max" with a natural order (earliest end, farthest reach)',
      },
      { he: "קפיצות, תחנות דלק, לוח זמנים", en: "Jumps, gas stations, scheduling" },
      {
        he: "n גדול (10^5) ו-DP ריבועי לא ייכנס בזמן",
        en: "Large n (10^5) and a quadratic DP won't fit the time limit",
      },
    ],
    template: `sort by the key that makes the local choice safe
for item in items:
    if choosing item keeps the solution valid:
        take it; update state`,
    time: "O(n) or O(n log n) with sorting",
    space: "O(1)",
    pitfalls: [
      {
        he: "חמדנות בלי הוכחה: לבדוק על דוגמה קטנה מול brute force",
        en: "Greedy without proof: check small cases against brute force",
      },
      { he: "מיון לפי המפתח הלא נכון", en: "Sorting by the wrong key" },
    ],
    variants: [
      { he: '"הכי רחוק שאפשר להגיע" (קפיצות)', en: '"Farthest reachable" (jumps)' },
      { he: "בחירה לפי סוף מוקדם (טווחים)", en: "Pick by earliest end (intervals)" },
      { he: "חמדנות עם ערימה (תמיד את הזול/הדחוף)", en: "Greedy with a heap (always the cheapest / most urgent)" },
    ],
    uses: ["array", "heap"],
    related: ["intervals", "heap", "dp-1d"],
  },
  {
    id: "bit-manipulation",
    name: "Bit manipulation",
    family: "other",
    summary: {
      he: 'פעולות על ביטים (XOR, AND, הזזות) פותרות בעיות של זוגיות, "האיבר שמופיע פעם אחת", וייצוג קבוצות קטנות כמספר (bitmask).',
      en: 'Bit operations (XOR, AND, shifts) solve parity questions, "the element that appears once", and represent small sets as a number (bitmask).',
    },
    signals: [
      {
        he: '"כל איבר מופיע פעמיים חוץ מאחד", בלי זיכרון נוסף',
        en: '"Every element appears twice except one", no extra memory',
      },
      { he: "ספירת ביטים דלוקים, חזקות של 2", en: "Counting set bits, powers of two" },
      {
        he: 'n ≤ 20 ומצב שהוא "אילו פריטים כבר נבחרו" (bitmask DP)',
        en: 'n ≤ 20 and the state is "which items were already used" (bitmask DP)',
      },
    ],
    template: `x ^ x = 0, x ^ 0 = x       # pairs cancel out
x & (x - 1)                # drops the lowest set bit
(mask >> i) & 1            # is item i in the set?
mask | (1 << i)            # add item i`,
    time: "O(n) or O(bits)",
    space: "O(1)",
    pitfalls: [
      { he: "עדיפות אופרטורים: לשים סוגריים סביב & ו-^", en: "Operator precedence: put parentheses around & and ^" },
      { he: "מספרים שליליים והזזה אריתמטית", en: "Negative numbers and arithmetic shifts" },
    ],
    variants: [
      { he: "XOR לביטול זוגות", en: "XOR to cancel pairs" },
      { he: "bitmask לייצוג תת-קבוצה", en: "Bitmask as a subset" },
    ],
    uses: ["array"],
    related: ["hashing", "dp-1d"],
  },
  {
    id: "trie",
    name: "Trie (prefix tree)",
    family: "tree",
    summary: {
      he: "עץ שבו כל צומת הוא תו, וכל מסלול מהשורש הוא תחילית. חיפוש מילה או תחילית ב-O(אורך המילה), בלי קשר לכמות המילים.",
      en: "A tree where each node is a character and each root path is a prefix. Word or prefix lookups in O(word length), regardless of how many words there are.",
    },
    signals: [
      { he: '"תחילית", "השלמה אוטומטית", "מתחיל ב..."', en: '"Prefix", "autocomplete", "starts with..."' },
      {
        he: "מילון של הרבה מילים ומחפשים כמה מהן על לוח / בטקסט",
        en: "A dictionary of many words searched on a board / in text",
      },
      { he: "XOR מקסימלי (trie על ביטים)", en: "Maximum XOR (a trie over bits)" },
    ],
    template: `node = root
for ch in word:
    node = node.children.setdefault(ch, Node())
node.is_word = True
# search: walk the same way; prefix exists if you never fall off`,
    time: "O(L) per insert / lookup",
    space: "O(total characters)",
    pitfalls: [
      {
        he: 'לבלבל בין "תחילית קיימת" ל"מילה שלמה קיימת" (is_word)',
        en: 'Confusing "prefix exists" with "whole word exists" (is_word)',
      },
      { he: "לגזום ענפים שכבר נמצאו כדי לא לחפש שוב", en: "Prune branches already found so you don't search again" },
    ],
    variants: [
      { he: "trie + backtracking על לוח", en: "Trie + backtracking on a board" },
      { he: "trie על ביטים", en: "Bitwise trie" },
    ],
    uses: ["trie", "hash-map"],
    related: ["hashing", "backtracking"],
  },
];

export const PATTERN_BY_ID = new Map<PatternId, Pattern>(PATTERNS.map((p) => [p.id, p]));
export const patternName = (id: string) => PATTERN_BY_ID.get(id as PatternId)?.name ?? id;
