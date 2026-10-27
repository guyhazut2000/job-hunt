import type { Company, Job } from "@prisma/client";
import { getLLMProvider } from "@/lib/ai";
import { db } from "@/lib/db";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n";
import { peopleSearchStrings } from "@/lib/i18n/people-search";
import { outreachContext } from "@/lib/outreach/context";
import { DOMAIN_SCOPED, domainTerms, peopleLinks } from "@/lib/outreach/links";
import { templateMessage } from "@/lib/outreach/messages";
import { peopleSearchConfig } from "@/lib/people/config";
import { normalizeProfileUrl } from "@/lib/people/parse";
import { PeopleSection, type PeopleCategoryItem } from "./PeopleSection";

/**
 * "People at this company": LinkedIn/Google search links per audience plus ready-to-send messages.
 * Templates for both languages are rendered here (instant, no LLM); the client can upgrade one with AI.
 */
export async function People({
  company,
  job,
  userId,
  t,
}: {
  company: Pick<Company, "id" | "name">;
  job?: Pick<Job, "id" | "title" | "applyUrl" | "techStack" | "roleCategory"> | null;
  userId?: string | null;
  t: Dictionary;
}) {
  const [profile, user, contacts] = userId
    ? await Promise.all([
        db.profile.findUnique({ where: { userId } }),
        db.user.findUnique({ where: { id: userId }, select: { name: true } }),
        db.contact.findMany({
          where: { userId, companyId: company.id, ...(job ? { OR: [{ jobId: job.id }, { jobId: null }] } : {}) },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, title: true, linkedinUrl: true, category: true, status: true, notes: true },
        }),
      ])
    : [null, null, []];
  const ctx = outreachContext(company, job ?? null, profile, user?.name);
  const roleCategory = job?.roleCategory ?? null;
  const hasDomain = domainTerms(roleCategory).length > 0;
  const items: PeopleCategoryItem[] = peopleLinks(company.name, roleCategory).map((l) => ({
    ...l,
    domain: hasDomain && DOMAIN_SCOPED.has(l.category) && roleCategory ? t.roles[roleCategory] : null,
    messages: { he: templateMessage(l.category, ctx, "he"), en: templateMessage(l.category, ctx, "en") },
  }));
  const locale = await getLocale();
  const savedKeys = contacts.flatMap((c) => normalizeProfileUrl(c.linkedinUrl)?.key ?? []);
  return (
    <PeopleSection
      company={{ id: company.id, name: company.name }}
      jobId={job?.id ?? null}
      items={items}
      contacts={contacts}
      loggedIn={!!userId}
      canAi={!!userId && getLLMProvider().name !== "mock"}
      defaultLang="he"
      t={t.people}
      search={{ enabled: peopleSearchConfig().enabled, locale, savedKeys, s: peopleSearchStrings[locale] }}
    />
  );
}
