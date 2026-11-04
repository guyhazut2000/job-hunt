"use client";

import { useActionState } from "react";
import { acceptOffer, type AcceptState } from "@/app/closing/actions";
import type { ClosingStrings } from "@/lib/i18n/closing";
import { fillC } from "@/lib/i18n/closing";
import { Button } from "@/components/ui/button";

/** Accept step with an explicit confirmation checkbox. Shows exactly which applications will be archived. */
export function AcceptOffer({
  s,
  offerId,
  willArchive,
}: {
  s: ClosingStrings;
  offerId: string;
  willArchive: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptOffer, undefined);
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="accept-form">
      <input type="hidden" name="offerId" value={offerId} />
      {willArchive.length ? (
        <div className="text-sm">
          <p className="font-medium">{fillC(s.accWillArchive, { n: willArchive.length })}</p>
          <ul className="text-muted-foreground mt-1 list-disc ps-5" data-testid="accept-archive-list">
            {willArchive.map((a) => (
              <li key={a.id}>
                <bdi>{a.label}</bdi>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{s.accNothing}</p>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="pause" className="mt-0.5 size-4 shrink-0" data-testid="accept-pause" />
        <span>{s.accPause}</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="confirm"
          required
          className="mt-0.5 size-4 shrink-0"
          data-testid="accept-confirm"
        />
        <span>{s.accConfirm}</span>
      </label>
      <div>
        <Button type="submit" disabled={pending} data-testid="accept-submit">
          {s.accCta}
        </Button>
      </div>
      {state && "error" in state && (
        <p className="text-destructive text-sm" role="alert">
          {state.error === "other" ? s.accOther : s.error}
        </p>
      )}
    </form>
  );
}
