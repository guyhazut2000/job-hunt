"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/voice/VoiceInputButton";
import { addReferralContact, importReferralContacts } from "@/app/referrals/actions";
import { fillRef, type ReferralStrings } from "@/lib/i18n/referrals";

const EMPTY = { name: "", company: "", title: "", email: "", linkedinUrl: "", relationship: "", notes: "" };

export function AddContactForm({ s, companies }: { s: ReferralStrings; companies: string[] }) {
  const router = useRouter();
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const relRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const set = (p: Partial<typeof EMPTY>) => setF((x) => ({ ...x, ...p }));
  const field = (k: "name" | "company" | "title" | "email" | "linkedinUrl", label: string, ltr = false) => (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <Input
        value={f[k]}
        maxLength={k === "linkedinUrl" ? 300 : 120}
        dir={ltr ? "ltr" : "auto"}
        list={k === "company" ? "referral-company-list" : undefined}
        type={k === "email" ? "email" : "text"}
        onChange={(e) => set({ [k]: e.target.value })}
        data-testid={`referral-add-${k}`}
      />
    </label>
  );
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!f.name.trim() || !f.company.trim()) return setErr(s.errName);
    start(async () => {
      const res = await addReferralContact(f);
      if ("error" in res)
        return setErr(res.error === "linkedin" ? s.errLinkedin : res.error === "email" ? s.errEmail : s.errName);
      setF(EMPTY);
      router.refresh();
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="referral-add-form">
      <div className="grid gap-3 sm:grid-cols-2">
        {field("name", s.name)}
        {field("company", s.company)}
        {field("title", s.roleTitle)}
        {field("email", s.email, true)}
      </div>
      <datalist id="referral-company-list">
        {companies.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      {field("linkedinUrl", s.linkedin, true)}
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {s.relationship}
        <span className="flex items-center gap-2">
          <Input
            ref={relRef}
            value={f.relationship}
            maxLength={200}
            dir="auto"
            placeholder={s.relationshipPh}
            onChange={(e) => set({ relationship: e.target.value })}
            data-testid="referral-add-relationship"
          />
          <VoiceInputButton
            onText={(v) => set({ relationship: v })}
            getValue={() => relRef.current?.value ?? ""}
            maxLength={200}
            compact
            testId="referral-add-relationship-voice"
          />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {s.notes}
        <span className="flex items-start gap-2">
          <Textarea
            ref={notesRef}
            value={f.notes}
            rows={2}
            maxLength={500}
            dir="auto"
            onChange={(e) => set({ notes: e.target.value })}
            data-testid="referral-add-notes"
          />
          <VoiceInputButton
            onText={(v) => set({ notes: v })}
            getValue={() => notesRef.current?.value ?? ""}
            maxLength={500}
            compact
            testId="referral-add-notes-voice"
          />
        </span>
      </label>
      {err && (
        <p className="text-destructive text-sm" role="alert">
          {err}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending} data-testid="referral-add-submit">
          <UserPlus className="size-4" aria-hidden /> {s.add}
        </Button>
      </div>
    </form>
  );
}

export function CsvImport({ s }: { s: ReferralStrings }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 512 * 1024) return setMsg(s.importTooBig);
    setText(await file.text());
  };
  const run = () =>
    start(async () => {
      const res = await importReferralContacts(text);
      if ("error" in res) return setMsg(res.error === "no_header" ? s.importNoHeader : s.importTooBig);
      setMsg(fillRef(s.importDone, res));
      setText("");
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-3" data-testid="referral-import">
      <p className="text-muted-foreground text-sm">{s.importLead}</p>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {s.importFile}
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-sm"
          onChange={(e) => onFile(e.target.files?.[0])}
          data-testid="referral-import-file"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {s.importPaste}
        <Textarea
          value={text}
          rows={4}
          dir="ltr"
          className="font-mono text-xs"
          placeholder={"First Name,Last Name,Company,Position\nDana,Levi,Wix,Engineering Manager"}
          onChange={(e) => setText(e.target.value)}
          data-testid="referral-import-text"
        />
      </label>
      <p className="text-muted-foreground text-xs">{s.importPrivacy}</p>
      {msg && (
        <p className="text-sm font-semibold" role="status" data-testid="referral-import-result">
          {msg}
        </p>
      )}
      <div>
        <Button onClick={run} disabled={pending || !text.trim()} data-testid="referral-import-submit">
          <Upload className="size-4" aria-hidden /> {s.importBtn}
        </Button>
      </div>
    </div>
  );
}
