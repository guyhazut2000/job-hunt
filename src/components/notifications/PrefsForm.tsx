"use client";

import { useActionState } from "react";
import { saveNotificationPrefs, type PrefsFormState } from "@/app/notification-actions";
import { Button } from "@/components/ui/button";
import type { NotificationStrings } from "@/lib/i18n/notifications";
import type { ReminderStrings } from "@/lib/i18n/reminders";
import {
  channelEnabled,
  deliveryMode,
  EXTERNAL_CHANNELS,
  INSTANT_ONLY,
  NOTIFICATION_KINDS,
} from "@/lib/notifications/kinds";
import type { EffectivePrefs } from "@/lib/notifications/prefs";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

const selectCls =
  "border-input bg-background focus-visible:ring-ring/50 h-10 rounded-md border px-2 text-sm tabular-nums outline-none focus-visible:ring-3";
const checkCls = "accent-primary size-4.5 shrink-0";

export function PrefsForm({ prefs, s, r }: { prefs: EffectivePrefs; s: NotificationStrings; r: ReminderStrings }) {
  const [state, action, pending] = useActionState<PrefsFormState, FormData>(saveNotificationPrefs, undefined);
  return (
    <form action={action} className="flex flex-col gap-6" data-testid="prefs-form">
      <section aria-labelledby="what-h" className="card flex flex-col gap-3">
        <h2 id="what-h" className="font-heading text-lg font-bold">
          {s.whatWhere}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-start text-xs">
                <th scope="col" className="py-2 text-start font-semibold">
                  {s.kindCol}
                </th>
                <th scope="col" className="px-1 py-2 font-semibold whitespace-nowrap sm:px-2">
                  {s.inSite}
                </th>
                {EXTERNAL_CHANNELS.map((ch) => (
                  <th key={ch} scope="col" className="px-2 py-2 font-semibold">
                    {s[ch]}
                  </th>
                ))}
                <th scope="col" className="px-2 py-2 font-semibold">
                  {s.modeCol}
                </th>
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_KINDS.map((kind) => (
                <tr key={kind} className="border-b last:border-0">
                  <th scope="row" className="py-2.5 text-start font-normal">
                    <span className="block font-semibold">{s.kinds[kind]}</span>
                    <span className="text-muted-foreground block text-xs">{s.kindHints[kind]}</span>
                  </th>
                  <td className="px-1 text-center sm:px-2">
                    <input
                      type="checkbox"
                      checked
                      disabled
                      aria-label={`${s.kinds[kind]} — ${s.inSite}`}
                      className={checkCls}
                    />
                  </td>
                  {EXTERNAL_CHANNELS.map((ch) => (
                    <td key={ch} className="px-1 text-center sm:px-2">
                      <input
                        type="checkbox"
                        name={`ch.${kind}.${ch}`}
                        defaultChecked={channelEnabled(prefs.overrides, kind, ch)}
                        aria-label={`${s.kinds[kind]} — ${s[ch]}`}
                        className={checkCls}
                      />
                    </td>
                  ))}
                  <td className="px-1 text-center sm:px-2">
                    {INSTANT_ONLY.includes(kind) ? (
                      <span className="text-muted-foreground text-xs whitespace-nowrap">{s.modeLocked}</span>
                    ) : (
                      <select
                        name={`mode.${kind}`}
                        defaultValue={deliveryMode(prefs.modes, kind)}
                        aria-label={`${s.kinds[kind]} — ${s.modeCol}`}
                        className={`${selectCls} h-9 text-xs`}
                        data-testid={`mode-${kind}`}
                      >
                        <option value="instant">{s.modeInstant}</option>
                        <option value="digest">{s.modeDigest}</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-xs">{s.modeHint}</p>
        {!prefs.digestEnabled && Object.values(prefs.modes).includes("digest") ? (
          <p className="text-caution text-xs font-semibold" role="note" data-testid="mode-digest-off">
            {s.modeDigestOff}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="quiet-h" className="card flex flex-col gap-3">
        <h2 id="quiet-h" className="font-heading text-lg font-bold">
          {s.quiet}
        </h2>
        <p className="text-muted-foreground text-sm">{s.quietLead}</p>
        <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="quietEnabled" defaultChecked={prefs.quietEnabled} className={checkCls} />
          {s.quietEnabled}
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            {s.from}
            <select name="quietStart" defaultValue={prefs.quietStart} className={selectCls} dir="ltr">
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hh(h)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            {s.to}
            <select name="quietEnd" defaultValue={prefs.quietEnd} className={selectCls} dir="ltr">
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hh(h)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="quietShabbat" defaultChecked={prefs.quietShabbat} className={checkCls} />
          {s.shabbat}
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          {s.maxPerHour}
          <input
            type="number"
            name="maxPerHour"
            min={1}
            max={30}
            defaultValue={prefs.maxPerHour}
            className={`${selectCls} w-20`}
            dir="ltr"
          />
        </label>
      </section>

      <section aria-labelledby="follow-h" className="card flex flex-col gap-3">
        <h2 id="follow-h" className="font-heading text-lg font-bold">
          {s.followUp}
        </h2>
        <p className="text-muted-foreground text-sm">{s.followUpHint}</p>
        <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="followUpEnabled" defaultChecked={prefs.followUpEnabled} className={checkCls} />
          {s.followUpEnabled}
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          {s.followUpDays}
          <input
            type="number"
            name="followUpDays"
            min={1}
            max={60}
            defaultValue={prefs.followUpDays}
            className={`${selectCls} w-20`}
            dir="ltr"
          />
        </label>
      </section>

      <section aria-labelledby="interview-h" className="card flex flex-col gap-3">
        <h2 id="interview-h" className="font-heading text-lg font-bold">
          {r.interviewSection}
        </h2>
        <p className="text-muted-foreground text-sm">{r.interviewLead}</p>
        <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="interviewEnabled" defaultChecked={prefs.interviewEnabled} className={checkCls} />
          {r.interviewEnabled}
        </label>
      </section>

      <section aria-labelledby="learning-h" className="card flex flex-col gap-3">
        <h2 id="learning-h" className="font-heading text-lg font-bold">
          {r.learningSection}
        </h2>
        <p className="text-muted-foreground text-sm">{r.learningLead}</p>
        <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="learningEnabled" defaultChecked={prefs.learningEnabled} className={checkCls} />
          {r.learningEnabled}
        </label>
        <label className="flex items-center gap-2 text-sm">
          {r.learningHour}
          <select name="learningHour" defaultValue={prefs.learningHour} className={selectCls} dir="ltr">
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hh(h)}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm">{r.learningDays}</legend>
          <div className="flex flex-wrap gap-1.5">
            {r.weekdays.map((label, d) => (
              <label
                key={d}
                className="has-checked:border-primary has-checked:bg-primary/10 flex min-h-10 min-w-11 items-center justify-center gap-1.5 rounded-md border px-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="learningDays"
                  value={d}
                  defaultChecked={prefs.learningDays.includes(d)}
                  className={checkCls}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          {r.learningIdle}
          <input
            type="number"
            name="learningIdleDays"
            min={1}
            max={30}
            defaultValue={prefs.learningIdleDays}
            className={`${selectCls} w-20`}
            dir="ltr"
          />
        </label>
      </section>

      <section aria-labelledby="digest-h" className="card flex flex-col gap-3">
        <h2 id="digest-h" className="font-heading text-lg font-bold">
          {r.digestSection}
        </h2>
        <p className="text-muted-foreground text-sm">{r.digestLead}</p>
        <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="digestEnabled" defaultChecked={prefs.digestEnabled} className={checkCls} />
          {r.digestEnabled}
        </label>
        <label className="flex items-center gap-2 text-sm">
          {r.digestHour}
          <select name="digestHour" defaultValue={prefs.digestHour} className={selectCls} dir="ltr">
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {hh(h)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-muted-foreground text-xs">{s.emailDigestNote}</p>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} data-testid="prefs-save">
          {s.save}
        </Button>
        <p role="status" aria-live="polite" className="text-sm font-semibold">
          {state?.ok ? (
            <span className="text-fit">{s.saved}</span>
          ) : state?.error ? (
            <span className="text-destructive">{s.invalid}</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
