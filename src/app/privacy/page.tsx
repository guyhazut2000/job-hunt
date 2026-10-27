import { getDictionary } from "@/lib/i18n";

export const metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const { t, locale } = await getDictionary();
  return (
    <article className="mx-auto flex max-w-[68ch] flex-col gap-4 text-lg leading-relaxed">
      <p className="border-caution bg-caution-soft text-caution border-s-4 px-3 py-2 text-sm">{t.legal.draft}</p>
      {locale === "he" ? (
        <>
          <h1 className="text-title font-black">מדיניות פרטיות</h1>
          <p>
            אנו אוספים רק את המידע הדרוש להפעלת השירות: פרטי חשבון, פרופיל מקצועי, טקסט קורות חיים שהעלית ונתוני מעקב
            מועמדויות.
          </p>
          <p>קורות החיים משמשים לחישוב התאמה ולהפקת הצעות. אם הופעל ספק AI חיצוני, הטקסט נשלח אליו לצורך עיבוד בלבד.</p>
          <p>
            ניתן לבקש עיון, תיקון או מחיקה של המידע בכל עת. המדיניות תותאם לחוק הגנת הפרטיות, התשמ״א-1981 ולתקנות אבטחת
            מידע, ול-GDPR ככל שרלוונטי.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-title font-black">Privacy Policy</h1>
          <p>
            We collect only what is needed to run the service: account details, your professional profile, the text of
            CVs you upload and your application tracking data.
          </p>
          <p>
            Your CV is used to compute match scores and generate suggestions. If an external AI provider is enabled,
            text is sent to it for processing only.
          </p>
          <p>
            You can request access, correction or deletion at any time. This policy will be aligned with the Israeli
            Privacy Protection Law and, where relevant, GDPR.
          </p>
        </>
      )}
    </article>
  );
}
