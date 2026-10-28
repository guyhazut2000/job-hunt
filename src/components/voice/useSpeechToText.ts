"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  clampToMax,
  createSpeechSession,
  defaultVoiceLang,
  getSpeechRecognitionCtor,
  joinTranscript,
  parseVoiceLang,
  setFieldValue,
  voiceSupport,
  VOICE_LANG_STORAGE_KEY,
  type SpeechSession,
  type VoiceError,
  type VoiceLang,
  type VoiceState,
  type VoiceSupport,
} from "@/lib/voice/speech";

type Field = HTMLInputElement | HTMLTextAreaElement;

/* ---- shared dictation-language preference (localStorage, synced across buttons) ---- */
const LANG_EVENT = "jh-voice-lang";
function subscribeLang(cb: () => void) {
  window.addEventListener(LANG_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(LANG_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readLang(): VoiceLang {
  try {
    const v = parseVoiceLang(window.localStorage.getItem(VOICE_LANG_STORAGE_KEY));
    if (v) return v;
  } catch {
    /* storage blocked */
  }
  return defaultVoiceLang(document.documentElement.lang);
}
export function setVoiceLangPreference(l: VoiceLang) {
  try {
    window.localStorage.setItem(VOICE_LANG_STORAGE_KEY, l);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(LANG_EVENT));
}

export interface UseSpeechToTextOptions {
  /** Field the dictated text is appended to (works for controlled and uncontrolled inputs). */
  targetRef?: React.RefObject<Field | null>;
  /** Or: the id of the field (handy where the field has no ref). */
  targetId?: string;
  /** Alternative to targetRef: receive the full new value. */
  onText?: (value: string) => void;
  /** Current value when using onText. */
  getValue?: () => string;
  maxLength?: number;
}

export interface SpeechToText {
  /** null until mounted (SSR-safe). */
  support: VoiceSupport | null;
  state: VoiceState;
  listening: boolean;
  interim: string;
  error: VoiceError | null;
  denied: boolean;
  lang: VoiceLang;
  setLang: (l: VoiceLang) => void;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  clearError: () => void;
}

export function useSpeechToText(opts: UseSpeechToTextOptions = {}): SpeechToText {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const [support, setSupport] = useState<VoiceSupport | null>(null);
  const [state, setState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<VoiceError | null>(null);
  const [denied, setDenied] = useState(false);
  const lang = useSyncExternalStore(subscribeLang, readLang, () => "he-IL" as VoiceLang);

  const session = useRef<SpeechSession | null>(null);
  const committed = useRef("");
  const lastWritten = useRef<string | null>(null);

  const field = useCallback((): Field | null => {
    const o = optsRef.current;
    if (o.targetRef?.current) return o.targetRef.current;
    if (o.targetId) {
      const el = document.getElementById(o.targetId);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el;
    }
    return null;
  }, []);

  const read = useCallback((): string => {
    const o = optsRef.current;
    const el = field();
    if (el) return el.value;
    return o.getValue?.() ?? "";
  }, [field]);

  const write = useCallback(
    (v: string) => {
      const o = optsRef.current;
      const el = field();
      const max = o.maxLength ?? (el && el.maxLength > 0 ? el.maxLength : undefined);
      const next = clampToMax(v, max);
      lastWritten.current = next;
      if (el) setFieldValue(el, next);
      o.onText?.(next);
    },
    [field],
  );

  // If the user typed in the field while dictating, rebase on what's there now.
  // If the app cleared the field (e.g. the message was sent), end the dictation instead.
  const rebase = useCallback((): boolean => {
    const cur = read();
    if (lastWritten.current !== null && cur !== lastWritten.current) {
      if (!cur.trim() && lastWritten.current.trim()) {
        session.current?.abort();
        lastWritten.current = null;
        committed.current = "";
        return false;
      }
      committed.current = cur;
    }
    return true;
  }, [read]);

  useEffect(() => {
    setSupport(voiceSupport(window as unknown as Parameters<typeof voiceSupport>[0]));
    let status: PermissionStatus | null = null;
    const onChange = () => setDenied(status?.state === "denied");
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((s) => {
        status = s;
        onChange();
        s.addEventListener?.("change", onChange);
      })
      .catch(() => {
        /* Safari/Firefox may not support querying the microphone permission */
      });
    return () => {
      status?.removeEventListener?.("change", onChange);
      session.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    if (session.current && session.current.state !== "idle") return;
    const Ctor = getSpeechRecognitionCtor(window as unknown as Parameters<typeof getSpeechRecognitionCtor>[0]);
    if (!Ctor) return;
    setError(null);
    committed.current = read();
    lastWritten.current = null;
    session.current = createSpeechSession(Ctor, {
      onState: setState,
      onInterim: (t) => {
        setInterim(t);
        if (!t) return;
        if (!rebase()) return;
        write(joinTranscript(committed.current, t));
      },
      onFinal: (t) => {
        if (!rebase()) return;
        committed.current = joinTranscript(committed.current, t);
        write(committed.current);
      },
      onError: (e) => {
        setError(e);
        if (e === "denied") setDenied(true);
      },
    });
    session.current.start(readLang());
  }, [read, rebase, write]);

  const stop = useCallback(() => session.current?.stop(), []);

  const toggle = useCallback(() => {
    if (session.current && session.current.state !== "idle") stop();
    else start();
  }, [start, stop]);

  const setLang = useCallback(
    (l: VoiceLang) => {
      setVoiceLangPreference(l);
      // Restart a running session in the new language.
      if (session.current && session.current.state !== "idle") {
        session.current.abort();
        setTimeout(start, 0);
      }
    },
    [start],
  );

  return {
    support,
    state,
    listening: state === "listening" || state === "starting",
    interim,
    error,
    denied,
    lang,
    setLang,
    start,
    stop,
    toggle,
    clearError: () => setError(null),
  };
}
