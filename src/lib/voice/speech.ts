/**
 * Browser speech-to-text (Web Speech API) — framework-agnostic core used by `useSpeechToText`.
 *
 * Free and client-side: we never send audio to our own server or to Gemini. Note that some browsers
 * (Chrome, Edge) run recognition on the browser vendor's cloud service; Safari may run it on-device.
 * Firefox does not implement SpeechRecognition, so the UI degrades to a disabled button + tooltip.
 */

export type VoiceLang = "he-IL" | "en-US";
export const VOICE_LANGS: readonly VoiceLang[] = ["he-IL", "en-US"] as const;
export const VOICE_LANG_STORAGE_KEY = "jh_voice_lang";

export type VoiceSupport = "supported" | "unsupported" | "insecure";
export type VoiceState = "idle" | "starting" | "listening" | "stopping";
export type VoiceError = "denied" | "no-speech" | "no-mic" | "network" | "lang" | "aborted" | "unknown";

/* Minimal structural typing of the (not yet in lib.dom) SpeechRecognition API. */
export interface SpeechAlternativeLike {
  transcript: string;
}
export interface SpeechResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternativeLike;
}
export interface SpeechResultListLike {
  readonly length: number;
  [index: number]: SpeechResultLike;
}
export interface SpeechResultEventLike {
  resultIndex: number;
  results: SpeechResultListLike;
}
export interface SpeechErrorEventLike {
  error: string;
}
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((e: SpeechResultEventLike) => void) | null;
  onerror: ((e: SpeechErrorEventLike) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type WindowLike = {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
  isSecureContext?: boolean;
};

export function getSpeechRecognitionCtor(win: WindowLike | undefined): SpeechRecognitionCtor | null {
  if (!win) return null;
  const C = win.SpeechRecognition ?? win.webkitSpeechRecognition;
  return typeof C === "function" ? (C as SpeechRecognitionCtor) : null;
}

export function voiceSupport(win: WindowLike | undefined): VoiceSupport {
  if (!getSpeechRecognitionCtor(win)) return "unsupported";
  if (win && win.isSecureContext === false) return "insecure";
  return "supported";
}

export function mapSpeechError(code: string): VoiceError {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "denied";
    case "no-speech":
      return "no-speech";
    case "audio-capture":
      return "no-mic";
    case "network":
      return "network";
    case "language-not-supported":
      return "lang";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

/** Default recognition language for a UI locale. */
export function defaultVoiceLang(locale: string | undefined): VoiceLang {
  return locale?.toLowerCase().startsWith("en") ? "en-US" : "he-IL";
}

export function parseVoiceLang(v: string | null | undefined): VoiceLang | null {
  return VOICE_LANGS.includes(v as VoiceLang) ? (v as VoiceLang) : null;
}

export function otherVoiceLang(l: VoiceLang): VoiceLang {
  return l === "he-IL" ? "en-US" : "he-IL";
}

/** Append dictated text to existing field text with sensible spacing (no double spaces). */
export function joinTranscript(base: string, addition: string): string {
  const add = addition.replace(/\s+/g, " ").trim();
  if (!add) return base;
  if (!base) return add;
  return /[\s\n]$/.test(base) ? base + add : `${base} ${add}`;
}

/** Truncate to a field's maxLength (if any). */
export function clampToMax(text: string, maxLength?: number): string {
  return maxLength && maxLength > 0 && text.length > maxLength ? text.slice(0, maxLength) : text;
}

/** Split a result event into newly-final text and the current interim text. */
export function readResults(e: SpeechResultEventLike): { final: string; interim: string } {
  let final = "";
  let interim = "";
  for (let i = e.resultIndex; i < e.results.length; i++) {
    const r = e.results[i];
    const text = r?.[0]?.transcript ?? "";
    if (r.isFinal) final = joinTranscript(final, text);
    else interim = joinTranscript(interim, text);
  }
  return { final, interim };
}

export interface SpeechSessionHandlers {
  onState?: (s: VoiceState) => void;
  /** Interim (not yet final) text for the current utterance; "" clears it. */
  onInterim?: (text: string) => void;
  /** A finalized chunk of text. */
  onFinal?: (text: string) => void;
  onError?: (e: VoiceError) => void;
}

export interface SpeechSession {
  start(lang: VoiceLang): void;
  stop(): void;
  abort(): void;
  readonly state: VoiceState;
}

/**
 * Wraps one SpeechRecognition instance. `continuous` + `interimResults` so text appears live; the
 * browser ends the session itself after a pause, or the user presses stop.
 */
export function createSpeechSession(Ctor: SpeechRecognitionCtor, h: SpeechSessionHandlers): SpeechSession {
  let rec: SpeechRecognitionLike | null = null;
  let state: VoiceState = "idle";
  const set = (s: VoiceState) => {
    if (state === s) return;
    state = s;
    h.onState?.(s);
  };

  const session: SpeechSession = {
    get state() {
      return state;
    },
    start(lang) {
      if (state !== "idle") return;
      const r = new Ctor();
      rec = r;
      r.lang = lang;
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.onstart = () => {
        if (rec === r) set("listening");
      };
      r.onresult = (e) => {
        if (rec !== r) return;
        const { final, interim } = readResults(e);
        if (final) h.onFinal?.(final);
        h.onInterim?.(interim);
      };
      r.onerror = (e) => {
        if (rec !== r) return;
        const err = mapSpeechError(e.error);
        if (err !== "aborted") h.onError?.(err);
      };
      r.onend = () => {
        if (rec !== r) return;
        rec = null;
        h.onInterim?.("");
        set("idle");
      };
      set("starting");
      try {
        r.start();
      } catch {
        rec = null;
        set("idle");
        h.onError?.("unknown");
      }
    },
    stop() {
      if (!rec) return;
      set("stopping");
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    },
    abort() {
      const r = rec;
      if (!r) return;
      rec = null;
      try {
        r.abort();
      } catch {
        /* ignore */
      }
      h.onInterim?.("");
      set("idle");
    },
  };
  return session;
}

/**
 * Set a (possibly React-controlled) input/textarea's value and fire an `input` event so React's
 * onChange and any listeners run, exactly as if the user typed.
 */
export function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc?.set) desc.set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
