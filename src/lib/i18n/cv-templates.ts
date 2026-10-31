/** Fixed CV labels (rendered inside the exported CV) and UI strings for /cv. docs/cv-templates.md */
import type { BuiltinSection } from "@/lib/cv-templates/sections";
import type { TemplateId } from "@/lib/cv-templates/templates";
import type { Locale } from "./dictionaries";

export type CvLang = "he" | "en";

/** Labels printed in the CV itself — chosen by the export language, not the UI locale. */
export const CV_LABELS: Record<
  CvLang,
  {
    sections: Record<BuiltinSection, string>;
    /** Per-template overrides of section headings. */
    overrides: Partial<Record<TemplateId, Partial<Record<BuiltinSection, string>>>>;
    present: string;
    levels: Record<"BASIC" | "CONVERSATIONAL" | "FLUENT" | "NATIVE", string>;
    links: Record<"linkedin" | "github" | "portfolio", string>;
    tech: string;
  }
> = {
  he: {
    sections: {
      summary: "תקציר",
      experience: "ניסיון תעסוקתי",
      projects: "פרויקטים",
      education: "השכלה",
      skills: "כישורים",
      languages: "שפות",
      military: "שירות צבאי",
      volunteering: "התנדבות",
      links: "קישורים",
    },
    overrides: {
      executive: { summary: "פרופיל ניהולי", experience: "ניסיון ניהולי והישגים" },
      junior: { projects: "פרויקטים נבחרים", summary: "על עצמי" },
      creative: { summary: "קצת עליי", skills: "כלים וכישורים" },
      classic: { summary: "תמצית" },
    },
    present: "היום",
    levels: { BASIC: "בסיסית", CONVERSATIONAL: "שיחה", FLUENT: "שוטפת", NATIVE: "שפת אם" },
    links: { linkedin: "LinkedIn", github: "GitHub", portfolio: "תיק עבודות" },
    tech: "טכנולוגיות",
  },
  en: {
    sections: {
      summary: "Summary",
      experience: "Experience",
      projects: "Projects",
      education: "Education",
      skills: "Skills",
      languages: "Languages",
      military: "Military Service",
      volunteering: "Volunteering",
      links: "Links",
    },
    overrides: {
      executive: { summary: "Executive Profile", experience: "Leadership Experience & Achievements" },
      junior: { projects: "Selected Projects", summary: "About Me" },
      creative: { summary: "About", skills: "Tools & Skills" },
      classic: { summary: "Profile" },
    },
    present: "Present",
    levels: { BASIC: "Basic", CONVERSATIONAL: "Conversational", FLUENT: "Fluent", NATIVE: "Native" },
    links: { linkedin: "LinkedIn", github: "GitHub", portfolio: "Portfolio" },
    tech: "Tech",
  },
};

const he = {
  kicker: "קורות חיים",
  title: "תבניות קורות חיים",
  lead: "בוחרים תבנית, מסדרים את הסעיפים בגרירה ומורידים PDF או Word בעברית או באנגלית. התוכן מגיע תמיד מהפרופיל שלך — התבנית קובעת רק עיצוב, סדר וכותרות.",
  fitsFor: "מתאים ל:",
  recommended: "מומלץ עבורך",
  current: "התבנית שלך",
  choose: "עריכה והורדה",
  emptyProfile: "הפרופיל שלך עדיין ריק, אז התצוגה מציגה דוגמה. מלאו את הפרופיל כדי לראות את קורות החיים שלכם.",
  toProfile: "לעריכת הפרופיל",
  tailoredFrom: "מעצב קו״ח מותאמים: {title}",
  tailoredClear: "חזרה לקו״ח הבסיסיים",
  templates: {
    hitech: { name: "הייטק ופיתוח", fits: "מפתחים, DevOps, QA ודאטה — עמודה אחת שמערכות ATS קוראות היטב" },
    executive: { name: "ניהול ובכירים", fits: "מנהלים, ראשי צוותים ובכירים — תקציר ניהולי והישגים בראש" },
    junior: { name: "ג׳וניור, סטודנטים והסבה", fits: "סטודנטים, בוגרים ומי שעושה הסבה — השכלה ופרויקטים לפני ניסיון" },
    creative: { name: "מוצר, עיצוב ויצירה", fits: "מנהלי מוצר, מעצבים ושיווק — שתי עמודות עם צבע, ועדיין מודפס יפה" },
    classic: { name: "קלאסי", fits: "כל תחום, משרות שמרניות וגופים ציבוריים — פשוט ומסודר בגופן סריף" },
  } satisfies Record<TemplateId, { name: string; fits: string }>,
  editor: {
    back: "לכל התבניות",
    sections: "סעיפים",
    sectionsHint:
      "גוררים כדי לשנות סדר (או מסמנים סעיף ומזיזים בחצים), מסתירים ומשנים כותרות. נשמר אוטומטית לתבנית הזו.",
    drag: "גרירה: {name}",
    moveUp: "העברה למעלה: {name}",
    moveDown: "העברה למטה: {name}",
    hide: "הסתרה: {name}",
    show: "הצגה: {name}",
    rename: "שינוי כותרת: {name}",
    renamePh: "כותרת (ריק = ברירת מחדל)",
    hidden: "מוסתר",
    empty: "ריק בפרופיל",
    sidebar: "עמודה צדדית",
    reset: "איפוס לסדר של התבנית",
    saved: "נשמר",
    saving: "שומר…",
    saveError: "השמירה נכשלה",
    preview: "תצוגה מקדימה",
    previewLang: "שפת קורות החיים",
    export: "הורדה",
    pdf: "PDF",
    docx: "Word (DOCX)",
    exporting: "מכין קובץ…",
    translateNote: "התוכן בפרופיל כתוב ב{from}. בהורדה ב{to} הוא יתורגם (בלי להוסיף פרטים); התצוגה מציגה את המקור.",
    translateOff: "תרגום אוטומטי לא זמין כרגע — הקובץ יירד עם הכותרות ב{to} והתוכן כפי שהוא כתוב בפרופיל.",
    setDefault: "קביעה כתבנית שלי",
    isDefault: "זו התבנית שלך",
    editContent: "עריכת התוכן בפרופיל",
    langHe: "עברית",
    langEn: "English",
    moved: "{name} הועבר למקום {n}",
    picked: "נבחר {name}. חצים מזיזים, רווח מניח.",
  },
  docsCard: {
    title: "תבניות קורות חיים",
    body: "5 עיצובים (הייטק, ניהול, ג׳וניור, יצירתי, קלאסי) שנבנים מהפרופיל שלך — סידור סעיפים בגרירה והורדה ל-PDF או Word בעברית או באנגלית.",
    cta: "לבחירת תבנית",
  },
  keyboardHelp: "לסידור במקלדת: Tab לידית הגרירה, רווח להרמה, חצים להזזה, רווח להנחה, Esc לביטול.",
};
type Strings = typeof he;

const en: Strings = {
  kicker: "CV",
  title: "CV templates",
  lead: "Pick a template, drag sections into order and download a PDF or Word file in Hebrew or English. Content always comes from your profile — the template only controls design, order and headings.",
  fitsFor: "Fits:",
  recommended: "Recommended for you",
  current: "Your template",
  choose: "Edit & download",
  emptyProfile:
    "Your profile is still empty, so previews show sample content. Fill in your profile to see your own CV.",
  toProfile: "Edit profile",
  tailoredFrom: "Styling a tailored CV: {title}",
  tailoredClear: "Back to the base CV",
  templates: {
    hitech: { name: "Tech & engineering", fits: "Developers, DevOps, QA and data — one ATS-friendly column" },
    executive: {
      name: "Management & executive",
      fits: "Managers, team leads and executives — leadership summary and achievements first",
    },
    junior: {
      name: "Junior, student & career change",
      fits: "Students, graduates and career changers — education and projects before experience",
    },
    creative: {
      name: "Product, design & creative",
      fits: "Product, design and marketing — two columns with colour, still prints cleanly",
    },
    classic: { name: "Classic", fits: "Any field, conservative and public-sector roles — plain serif layout" },
  },
  editor: {
    back: "All templates",
    sections: "Sections",
    sectionsHint:
      "Drag to reorder (or focus a handle and use the arrows), hide sections and rename headings. Saved automatically for this template.",
    drag: "Drag: {name}",
    moveUp: "Move up: {name}",
    moveDown: "Move down: {name}",
    hide: "Hide: {name}",
    show: "Show: {name}",
    rename: "Rename: {name}",
    renamePh: "Heading (empty = default)",
    hidden: "Hidden",
    empty: "Empty in profile",
    sidebar: "Sidebar",
    reset: "Reset to template order",
    saved: "Saved",
    saving: "Saving…",
    saveError: "Couldn't save",
    preview: "Preview",
    previewLang: "CV language",
    export: "Download",
    pdf: "PDF",
    docx: "Word (DOCX)",
    exporting: "Preparing file…",
    translateNote:
      "Your profile is written in {from}. Downloading in {to} translates it (never adding facts); the preview shows the original.",
    translateOff:
      "Automatic translation isn't available right now — the file will have {to} headings and your content as written.",
    setDefault: "Make this my template",
    isDefault: "This is your template",
    editContent: "Edit content in profile",
    langHe: "Hebrew",
    langEn: "English",
    moved: "{name} moved to position {n}",
    picked: "Picked up {name}. Arrows move, space drops.",
  },
  docsCard: {
    title: "CV templates",
    body: "5 designs (hi-tech, executive, junior, creative, classic) built from your profile — drag sections into order and download PDF or Word in Hebrew or English.",
    cta: "Pick a template",
  },
  keyboardHelp: "Keyboard: Tab to a drag handle, Space to lift, arrows to move, Space to drop, Esc to cancel.",
};

export const cvTemplateStrings = (locale: Locale): Strings => (locale === "en" ? en : he);
export type CvTemplateStrings = Strings;

export function sectionLabel(lang: CvLang, template: TemplateId, id: BuiltinSection): string {
  return CV_LABELS[lang].overrides[template]?.[id] ?? CV_LABELS[lang].sections[id];
}
