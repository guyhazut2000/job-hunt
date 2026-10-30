import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/titles";

export const generateMetadata = localizedTitle("terms");

export default async function TermsPage() {
  const { t, locale } = await getDictionary();
  return (
    <article className="mx-auto flex max-w-[68ch] flex-col gap-4 text-lg leading-relaxed">
      <p className="border-caution bg-caution-soft text-caution border-s-4 px-3 py-2 text-sm">{t.legal.draft}</p>
      {locale === "he" ? (
        <>
          <h1 className="text-title font-black">תנאי שימוש</h1>
          <p>
            השירות מציג משרות שמתפרסמות בלוחות משרות ציבוריים של חברות. ההגשה עצמה מתבצעת באתר החברה, ואיננו צד לתהליך
            הגיוס.
          </p>
          <p>ציוני התאמה והצעות AI הם המלצות בלבד ואינם מבטיחים תוצאה.</p>
          <p>זהו פרויקט אישי ללא מטרות רווח. השימוש בשירות אינו כרוך בתשלום.</p>
        </>
      ) : (
        <>
          <h1 className="text-title font-black">Terms of Service</h1>
          <p>
            The service lists jobs published on companies&apos; public job boards. Applications are submitted on the
            company&apos;s own site; we are not party to the hiring process.
          </p>
          <p>Match scores and AI suggestions are recommendations only and guarantee no outcome.</p>
          <p>This is a non-commercial personal project. Using the service is free of charge.</p>
        </>
      )}
    </article>
  );
}
