"use client";

import { useActionState } from "react";
import { login, register, type FormState } from "@/app/actions";

interface Labels {
  email: string;
  password: string;
  name: string;
  submit: string;
}

export function AuthForm({ mode, labels, next }: { mode: "login" | "register"; labels: Labels; next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? login : register, undefined);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "register" && (
        <div>
          <label className="label" htmlFor="name">
            {labels.name}
          </label>
          <input id="name" name="name" required className="input" autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          {labels.email}
        </label>
        <input id="email" name="email" type="email" required className="input" autoComplete="email" dir="ltr" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {labels.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 8 : 1}
          className="input"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          dir="ltr"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={pending} type="submit">
        {pending ? "…" : labels.submit}
      </button>
    </form>
  );
}
