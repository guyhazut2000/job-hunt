import { mergeCvSkills } from "@/app/actions";
import { CvUpload } from "@/components/CvUpload";
import { ProfileForm } from "@/components/ProfileForm";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { ROLE_CATEGORIES, SENIORITIES, WORK_MODES } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const { t } = await getDictionary();
  const [profile, resume] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.resume.findFirst({ where: { userId: user.id, isPrimary: true } }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t.profile.title}</h1>
      <ProfileForm
        values={profile ?? { skills: [] }}
        labels={{ ...t.profile, years: t.profile.years, linkedin: t.profile.linkedin, any: t.jobs.any }}
        options={{
          roles: ROLE_CATEGORIES.map((r) => [r, t.roles[r]]),
          seniorities: SENIORITIES.map((s) => [s, t.seniority[s]]),
          workModes: WORK_MODES.map((w) => [w, t.workMode[w]]),
        }}
      />
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">{t.profile.cv}</h2>
        <CvUpload label={t.profile.upload} button={t.profile.uploadBtn} detected={t.profile.detected} />
        <div className="border-t border-slate-200 pt-4 text-sm">
          <div className="font-medium">{t.profile.current}</div>
          {resume ? (
            <div className="space-y-2 pt-1">
              <div className="text-slate-600">
                {resume.fileName} · {resume.createdAt.toLocaleDateString("he-IL")}
              </div>
              <div className="flex flex-wrap gap-1" dir="ltr">
                {resume.skills.map((s) => (
                  <span key={s} className="chip">
                    {s}
                  </span>
                ))}
              </div>
              <form action={mergeCvSkills}>
                <button className="btn-ghost" type="submit">
                  {t.profile.addSkills}
                </button>
              </form>
            </div>
          ) : (
            <p className="text-slate-500">{t.profile.none}</p>
          )}
        </div>
      </section>
    </div>
  );
}
