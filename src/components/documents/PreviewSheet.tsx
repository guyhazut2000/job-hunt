"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { documentFileUrl } from "@/app/documents/actions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { MIME } from "@/lib/documents/constants";
import type { DocumentStrings } from "@/lib/i18n/documents";
import { fill } from "./fmt";
import type { DocumentRow } from "./types";

/** Inline preview through a fresh short-lived signed URL (PDF in an iframe, images as <img>). */
export function PreviewSheet({
  t,
  doc,
  onClose,
}: {
  t: DocumentStrings;
  doc: DocumentRow | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<{ id: string; src: string } | null>(null);
  useEffect(() => {
    if (!doc) return;
    let alive = true;
    void documentFileUrl(doc.id).then((src) => alive && src && setUrl({ id: doc.id, src }));
    return () => {
      alive = false;
    };
  }, [doc]);
  const src = doc && url?.id === doc.id ? url.src : null;

  return (
    <Sheet open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-2 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        <SheetHeader className="pe-12">
          <SheetTitle className="font-heading text-lg break-words" dir="auto">
            {doc ? fill(t.previewTitle, { title: doc.title }) : ""}
          </SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
          {!src && <Skeleton className="h-[70dvh] w-full" />}
          {src && doc?.mimeType === MIME.pdf && (
            <iframe src={src} title={doc.title} className="bg-muted h-[75dvh] w-full rounded-md border" />
          )}
          {src && doc && doc.mimeType !== MIME.pdf && (
            // eslint-disable-next-line @next/next/no-img-element -- private, short-lived URL; no optimizer
            <img
              src={src}
              alt={doc.title}
              className="bg-muted mx-auto max-h-[75dvh] w-auto max-w-full rounded-md border object-contain"
            />
          )}
          {doc && (
            <Button
              variant="outline"
              className="self-start"
              onClick={() => void documentFileUrl(doc.id, true).then((u) => u && window.location.assign(u))}
            >
              <Download aria-hidden />
              {t.download}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
