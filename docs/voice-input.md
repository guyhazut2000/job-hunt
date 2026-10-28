# Voice input (speech-to-text)

A microphone button next to free-text fields lets users dictate instead of typing. It uses the
browser's built-in **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`), so it is
free and needs no server, API key or quota. No audio is sent to our server or to Gemini.

> Privacy note: Chrome and Edge run recognition on the browser vendor's speech service; Safari may run
> it on-device. This is the browser's behaviour, not ours. Firefox has no `SpeechRecognition`.

## Where it appears

| Place                               | Field                                |
| ----------------------------------- | ------------------------------------ |
| `/chat` and the floating chat sheet | message input (compact in the sheet) |
| Learning stage → Practice           | "My solution / notes"                |
| Learning stage → Q&A                | "My answer" boxes                    |
| Learning stage → AI tutor           | tutor chat input                     |
| Learning hub                        | study-log note                       |
| `/jobs` and `/companies` search     | search box (hidden when unsupported) |
| Profile                             | summary, experience description      |
| Documents                           | document notes                       |
| Outreach                            | contact notes                        |
| Companies                           | suggest-a-company name               |

## Behaviour

- Click the mic → it turns red with a pulsing ring and becomes a **stop** button (`aria-pressed`).
- Interim words appear live in the field; finalized words are appended to whatever was already
  there (single space, respects the field's `maxLength`). The field's `onChange` fires as if typed,
  so controlled React inputs, debounced search and "unsaved changes" indicators all just work.
- The browser ends the session after a pause, or the user presses stop. Sending a chat message (the
  app clears the field) also ends dictation.
- **Language**: Hebrew (`he-IL`) by default, English (`en-US`) when the UI is in English. The small
  `עב` / `EN` chip toggles it; the choice is saved in `localStorage` (`jh_voice_lang`) and shared by
  all mic buttons. Switching while recording restarts in the new language.
- **Unsupported browser** (Firefox), **insecure origin** (plain http) or **blocked permission**: the mic
  shows crossed-out and `aria-disabled`; hovering or tapping shows a Hebrew tooltip explaining why
  (and, for a blocked mic, how to allow it). The search box hides the mic instead.
- Errors (no speech, no microphone, network) appear as a tooltip for a few seconds and are announced
  via an `aria-live` region.
- Renders nothing during SSR / before hydration (support detection needs `window`).

## Code

- `src/lib/voice/speech.ts` — framework-free core: support detection, `createSpeechSession`,
  result parsing, error mapping, `joinTranscript`, `setFieldValue`.
- `src/components/voice/useSpeechToText.ts` — React hook (state, permission query, language
  preference, writing into a field by `targetRef` / `targetId` or `onText`).
- `src/components/voice/VoiceInputButton.tsx` — the button (`size="sm" | "md"`, `compact`,
  `hideWhenUnsupported`, `disabled`).
- `src/lib/i18n/voice.ts` — Hebrew/English strings.
- Tests: `tests/voice-input.test.ts` (mocked `SpeechRecognition`).

### Adding it to a field

```tsx
<label htmlFor="my-notes">Notes</label>
<VoiceInputButton targetId="my-notes" size="sm" />
<textarea id="my-notes" />
```

or with a ref: `<VoiceInputButton targetRef={inputRef} />`.
