"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { ArrowRight } from "@/components/icons";
import { btnPrimary, input } from "@/components/ui";
import { login } from "./actions";

export default function LoginForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [state, action, pending] = useActionState(login, {});

  return (
    <form action={action} className="mt-7 space-y-4">
      {/* The server re-checks this is a local path before redirecting. */}
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Password</span>
        <input
          type="password"
          name="password"
          autoFocus
          required
          autoComplete="current-password"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
          className={`${input} px-4 py-3`}
        />
      </label>

      {state.error && (
        <p id="login-error" role="alert" className="rounded-control bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${btnPrimary} w-full px-5 py-3`}>
        {pending ? "Checking…" : "Log in"}
        {!pending && <ArrowRight />}
      </button>
    </form>
  );
}
