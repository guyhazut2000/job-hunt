import { Brand } from "./Brand";

/** Two-column auth layout: an editorial aside on desktop, just the form card on mobile. */
export function AuthShell({ title, aside, children }: { title: string; aside: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-4xl items-start gap-8 md:grid-cols-2 md:gap-12 md:pt-6">
      <div className="hidden flex-col gap-4 md:flex">
        <Brand />
        <p className="font-heading text-foreground/85 text-3xl leading-tight font-bold text-balance">{aside}</p>
      </div>
      <div className="bg-card flex flex-col gap-6 rounded-lg border p-5 shadow-[0_2px_0_var(--border)] sm:p-7">
        <h1 className="text-3xl font-black">{title}</h1>
        {children}
      </div>
    </div>
  );
}
