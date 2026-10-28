import type { Locale } from "./dictionaries";

const en = {
  start: "Dictate (voice input)",
  startLang: "Dictate in {lang}",
  stop: "Stop recording",
  listening: "Listening… speak now",
  listeningLang: "Listening ({lang})",
  stopped: "Recording stopped",
  langToggle: "Dictation language: {lang}. Click to switch to {other}",
  langs: { "he-IL": "Hebrew", "en-US": "English" },
  langShort: { "he-IL": "עב", "en-US": "EN" },
  unsupported: "Voice input isn't supported in this browser. Try Chrome, Edge or Safari.",
  insecure: "Voice input needs a secure (https) connection.",
  errors: {
    denied: "Microphone access is blocked. Allow it in the browser's site settings and try again.",
    "no-speech": "No speech detected — try again.",
    "no-mic": "No microphone found.",
    network: "Speech service unavailable (network). Try again later.",
    lang: "This language isn't supported by your browser's speech service.",
    aborted: "Recording stopped.",
    unknown: "Voice input failed. Try again.",
  },
};

export type VoiceStrings = typeof en;

const he: VoiceStrings = {
  start: "הקלטה קולית (דיבור לטקסט)",
  startLang: "הקלטה קולית ב{lang}",
  stop: "עצירת ההקלטה",
  listening: "מקשיב… אפשר לדבר",
  listeningLang: "מקשיב ({lang})",
  stopped: "ההקלטה נעצרה",
  langToggle: "שפת ההכתבה: {lang}. לחיצה תחליף ל{other}",
  langs: { "he-IL": "עברית", "en-US": "אנגלית" },
  langShort: { "he-IL": "עב", "en-US": "EN" },
  unsupported: "הדפדפן הזה לא תומך בהקלטה קולית. אפשר לנסות ב-Chrome, Edge או Safari.",
  insecure: "הקלטה קולית דורשת חיבור מאובטח (https).",
  errors: {
    denied: "הגישה למיקרופון חסומה. יש לאשר אותה בהגדרות האתר בדפדפן ולנסות שוב.",
    "no-speech": "לא נקלט דיבור, כדאי לנסות שוב.",
    "no-mic": "לא נמצא מיקרופון.",
    network: "שירות זיהוי הדיבור לא זמין כרגע (רשת). כדאי לנסות שוב מאוחר יותר.",
    lang: "שירות הדיבור של הדפדפן לא תומך בשפה הזו.",
    aborted: "ההקלטה נעצרה.",
    unknown: "ההקלטה הקולית נכשלה. כדאי לנסות שוב.",
  },
};

export function voiceStrings(locale: Locale | string | undefined): VoiceStrings {
  return locale === "en" ? en : he;
}

export function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}
