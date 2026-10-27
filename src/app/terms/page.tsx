import { getDictionary } from "@/lib/i18n";

export const metadata = { title: "Terms" };

export default async function TermsPage() {
  const { t, locale } = await getDictionary();
  return (
    <article className="card mx-auto max-w-3xl space-y-4 leading-relaxed">
      <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">{t.legal.draft}</p>
      {locale === "he" ? (
        <>
          <h1 className="text-2xl font-bold">תנאי שימוש</h1>
          <p>
            השירות מציג משרות שמתפרסמות בלוחות משרות ציבוריים של חברות. ההגשה עצמה מתבצעת באתר החברה, ואיננו צד לתהליך
            הגיוס.
          </p>
          <p>ציוני התאמה והצעות AI הם המלצות בלבד ואינם מבטיחים תוצאה.</p>
          <p>מנוי בתשלום (כאשר יופעל) מתחדש חודשית וניתן לביטול בכל עת בהתאם לחוק הגנת הצרכן.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Terms of Service</h1>
          <p>
            The service lists jobs published on companies&apos; public job boards. Applications are submitted on the
            company&apos;s own site; we are not party to the hiring process.
          </p>
          <p>Match scores and AI suggestions are recommendations only and guarantee no outcome.</p>
          <p>
            Paid subscriptions (once enabled) renew monthly and can be cancelled at any time in line with consumer
            protection law.
          </p>
        </>
      )}
    </article>
  );
}
