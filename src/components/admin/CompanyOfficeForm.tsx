import { adminSetCompanyOffice } from "@/app/admin/office-actions";
import type { JobsMapStrings } from "@/lib/i18n/jobs-map";
import { PendingButton } from "./PendingButton";

/** Admin card: override where a company's jobs are pinned on the jobs map. */
export function CompanyOfficeForm({
  companies,
  s,
}: {
  companies: { id: string; name: string; officeAddress: string | null }[];
  s: JobsMapStrings;
}) {
  return (
    <form action={adminSetCompanyOffice} className="card flex min-w-0 flex-col gap-3" data-admin-office>
      <h2 className="font-semibold">{s.adminOfficeTitle}</h2>
      <select name="companyId" required className="select-native" aria-label={s.adminOfficeTitle}>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.officeAddress ? `✓ ${c.name} — ${c.officeAddress}` : c.name}
          </option>
        ))}
      </select>
      <input
        name="officeAddress"
        aria-label={s.adminOfficeAddress}
        placeholder={s.adminOfficeAddress}
        className="input"
        dir="auto"
      />
      <input
        name="officeCity"
        aria-label={s.adminOfficeCity}
        placeholder={s.adminOfficeCity}
        className="input"
        dir="auto"
      />
      <p className="text-muted-foreground text-xs">{s.adminOfficeHint}</p>
      <PendingButton className="btn-primary" pendingLabel="…">
        {s.adminOfficeSave}
      </PendingButton>
    </form>
  );
}
