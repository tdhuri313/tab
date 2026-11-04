import { Suspense } from "react";
import SiteHeader from "@/components/SiteHeader";
import { card, eyebrow } from "@/components/ui";
import LoginForm from "./LoginForm";

/**
 * GET /login — the password gate (see proxy.ts). The card is static; the
 * form reads ?next= from the URL, so it sits inside <Suspense>.
 */
export default function LoginPage() {
  return (
    <>
      <SiteHeader bordered />
      <main className="mx-auto w-full max-w-md px-4 py-14 sm:py-20">
        <div className={`${card} p-6 sm:p-10`}>
          <p className={`${eyebrow} text-purple`}>Private workspace</p>
          <h1 className="mt-4 text-3xl tracking-tight">Welcome back.</h1>
          <p className="mt-3 text-ink-muted">Enter the password to see your invoices.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </>
  );
}
