"use client";

import { useActionState } from "react";
import { saveProfile, type FormState } from "@/app/actions";

export interface ProfileValues {
  headline?: string | null;
  desiredRole?: string | null;
  seniority?: string | null;
  location?: string | null;
  workMode?: string | null;
  yearsExperience?: number | null;
  skills: string[];
  linkedinUrl?: string | null;
}

export function ProfileForm({
  values,
  labels,
  options,
}: {
  values: ProfileValues;
  labels: Record<
    | "headline"
    | "desiredRole"
    | "seniority"
    | "location"
    | "workMode"
    | "years"
    | "skills"
    | "linkedin"
    | "save"
    | "any",
    string
  >;
  options: { roles: [string, string][]; seniorities: [string, string][]; workModes: [string, string][] };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, undefined);
  const sel = (name: string, label: string, value: string | null | undefined, opts: [string, string][]) => (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <select id={name} name={name} defaultValue={value ?? ""} className="input">
        <option value="">{labels.any}</option>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
  return (
    <form action={action} className="card grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="headline">
          {labels.headline}
        </label>
        <input id="headline" name="headline" defaultValue={values.headline ?? ""} className="input" />
      </div>
      {sel("desiredRole", labels.desiredRole, values.desiredRole, options.roles)}
      {sel("seniority", labels.seniority, values.seniority, options.seniorities)}
      <div>
        <label className="label" htmlFor="location">
          {labels.location}
        </label>
        <input id="location" name="location" defaultValue={values.location ?? ""} className="input" />
      </div>
      {sel("workMode", labels.workMode, values.workMode, options.workModes)}
      <div>
        <label className="label" htmlFor="yearsExperience">
          {labels.years}
        </label>
        <input
          id="yearsExperience"
          name="yearsExperience"
          type="number"
          min={0}
          max={50}
          defaultValue={values.yearsExperience ?? ""}
          className="input"
        />
      </div>
      <div>
        <label className="label" htmlFor="linkedinUrl">
          {labels.linkedin}
        </label>
        <input
          id="linkedinUrl"
          name="linkedinUrl"
          type="url"
          defaultValue={values.linkedinUrl ?? ""}
          className="input"
          dir="ltr"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="skills">
          {labels.skills}
        </label>
        <textarea
          id="skills"
          name="skills"
          rows={3}
          defaultValue={values.skills.join(", ")}
          className="input"
          dir="ltr"
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending} type="submit">
          {labels.save}
        </button>
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
