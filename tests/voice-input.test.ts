import { describe, expect, it, vi } from "vitest";
import {
  clampToMax,
  createSpeechSession,
  defaultVoiceLang,
  getSpeechRecognitionCtor,
  joinTranscript,
  mapSpeechError,
  otherVoiceLang,
  parseVoiceLang,
  readResults,
  setFieldValue,
  voiceSupport,
  type SpeechRecognitionLike,
  type SpeechResultEventLike,
} from "@/lib/voice/speech";
import { voiceStrings } from "@/lib/i18n/voice";

/** Mocked browser SpeechRecognition. */
class MockRecognition implements SpeechRecognitionLike {
  static instances: MockRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onresult: ((e: SpeechResultEventLike) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  started = false;
  start = vi.fn(() => {
    this.started = true;
    queueMicrotask(() => this.onstart?.());
  });
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => {
    this.onerror?.({ error: "aborted" });
    this.onend?.();
  });
  constructor() {
    MockRecognition.instances.push(this);
  }
  emit(resultIndex: number, results: Array<[string, boolean]>) {
    const list = results.map(([t, isFinal]) => Object.assign([{ transcript: t }], { isFinal }));
    this.onresult?.({ resultIndex, results: list });
  }
}
const last = () => MockRecognition.instances[MockRecognition.instances.length - 1];
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("support detection", () => {
  it("finds standard and webkit-prefixed constructors", () => {
    expect(getSpeechRecognitionCtor({ SpeechRecognition: MockRecognition })).toBe(MockRecognition);
    expect(getSpeechRecognitionCtor({ webkitSpeechRecognition: MockRecognition })).toBe(MockRecognition);
    expect(getSpeechRecognitionCtor({})).toBeNull();
    expect(getSpeechRecognitionCtor(undefined)).toBeNull();
    expect(getSpeechRecognitionCtor({ SpeechRecognition: "nope" })).toBeNull();
  });

  it("reports unsupported (Firefox) and insecure origins", () => {
    expect(voiceSupport({})).toBe("unsupported");
    expect(voiceSupport({ webkitSpeechRecognition: MockRecognition, isSecureContext: false })).toBe("insecure");
    expect(voiceSupport({ webkitSpeechRecognition: MockRecognition, isSecureContext: true })).toBe("supported");
  });
});

describe("helpers", () => {
  it("appends dictated text with single spacing", () => {
    expect(joinTranscript("", "  שלום  עולם ")).toBe("שלום עולם");
    expect(joinTranscript("Hello", "world")).toBe("Hello world");
    expect(joinTranscript("line\n", "next")).toBe("line\nnext");
    expect(joinTranscript("keep", "   ")).toBe("keep");
  });

  it("clamps to maxLength", () => {
    expect(clampToMax("abcdef", 3)).toBe("abc");
    expect(clampToMax("abc", undefined)).toBe("abc");
    expect(clampToMax("abc", -1)).toBe("abc");
  });

  it("maps languages and errors", () => {
    expect(defaultVoiceLang("he")).toBe("he-IL");
    expect(defaultVoiceLang("en")).toBe("en-US");
    expect(defaultVoiceLang(undefined)).toBe("he-IL");
    expect(otherVoiceLang("he-IL")).toBe("en-US");
    expect(parseVoiceLang("en-US")).toBe("en-US");
    expect(parseVoiceLang("fr-FR")).toBeNull();
    expect(mapSpeechError("not-allowed")).toBe("denied");
    expect(mapSpeechError("service-not-allowed")).toBe("denied");
    expect(mapSpeechError("audio-capture")).toBe("no-mic");
    expect(mapSpeechError("no-speech")).toBe("no-speech");
    expect(mapSpeechError("weird")).toBe("unknown");
  });

  it("splits final and interim results from resultIndex", () => {
    const results = [
      Object.assign([{ transcript: "old" }], { isFinal: true }),
      Object.assign([{ transcript: "אני מחפש" }], { isFinal: true }),
      Object.assign([{ transcript: "משרת" }], { isFinal: false }),
    ];
    expect(readResults({ resultIndex: 1, results })).toEqual({ final: "אני מחפש", interim: "משרת" });
  });

  it("has Hebrew strings with accessible labels", () => {
    const he = voiceStrings("he");
    expect(he.start).toMatch(/הקלטה קולית/);
    expect(he.stop).toMatch(/עצירת/);
    expect(he.unsupported).toMatch(/Chrome/);
    expect(voiceStrings("en").errors.denied).toMatch(/Microphone/);
  });
});

describe("speech session (mocked SpeechRecognition)", () => {
  it("configures recognition, streams interim then final text, and ends idle", async () => {
    const states: string[] = [];
    const interim: string[] = [];
    const finals: string[] = [];
    const s = createSpeechSession(MockRecognition, {
      onState: (x) => states.push(x),
      onInterim: (t) => interim.push(t),
      onFinal: (t) => finals.push(t),
    });
    s.start("he-IL");
    const r = last();
    expect(r.lang).toBe("he-IL");
    expect(r.continuous).toBe(true);
    expect(r.interimResults).toBe(true);
    await flush();
    expect(s.state).toBe("listening");
    r.emit(0, [["מפתח", false]]);
    r.emit(0, [["מפתח פולסטאק", true]]);
    expect(interim).toContain("מפתח");
    expect(finals).toEqual(["מפתח פולסטאק"]);
    s.stop();
    expect(r.stop).toHaveBeenCalled();
    expect(states).toEqual(["starting", "listening", "stopping", "idle"]);
    expect(interim[interim.length - 1]).toBe("");
  });

  it("reports permission denial and ignores abort errors", async () => {
    const errors: string[] = [];
    const s = createSpeechSession(MockRecognition, { onError: (e) => errors.push(e) });
    s.start("en-US");
    last().onerror?.({ error: "not-allowed" });
    last().onend?.();
    expect(errors).toEqual(["denied"]);
    expect(s.state).toBe("idle");
    s.start("en-US");
    s.abort();
    expect(errors).toEqual(["denied"]);
    expect(s.state).toBe("idle");
  });

  it("ignores a second start while running and survives start() throwing", () => {
    const s = createSpeechSession(MockRecognition, {});
    const before = MockRecognition.instances.length;
    s.start("he-IL");
    s.start("he-IL");
    expect(MockRecognition.instances.length).toBe(before + 1);
    s.abort();

    class Throwing extends MockRecognition {
      start = vi.fn(() => {
        throw new Error("InvalidStateError");
      });
    }
    const errors: string[] = [];
    const t = createSpeechSession(Throwing, { onError: (e) => errors.push(e) });
    t.start("he-IL");
    expect(t.state).toBe("idle");
    expect(errors).toEqual(["unknown"]);
  });

  it("drops events from a stale (aborted) recognizer", () => {
    const finals: string[] = [];
    const s = createSpeechSession(MockRecognition, { onFinal: (t) => finals.push(t) });
    s.start("he-IL");
    const r = last();
    s.abort();
    r.emit(0, [["late", true]]);
    expect(finals).toEqual([]);
  });
});

describe("setFieldValue", () => {
  it("uses the prototype setter and dispatches a bubbling input event", () => {
    const calls: string[] = [];
    class FakeField {
      _v = "";
      events: Event[] = [];
      dispatchEvent(e: Event) {
        this.events.push(e);
        return true;
      }
    }
    Object.defineProperty(FakeField.prototype, "value", {
      get(this: FakeField) {
        return this._v;
      },
      set(this: FakeField, v: string) {
        calls.push(v);
        this._v = v;
      },
    });
    const f = new FakeField();
    setFieldValue(f as unknown as HTMLInputElement, "שלום");
    expect(calls).toEqual(["שלום"]);
    expect(f.events[0].type).toBe("input");
    expect(f.events[0].bubbles).toBe(true);
  });
});
