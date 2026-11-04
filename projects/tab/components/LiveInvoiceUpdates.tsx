"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Close } from "@/components/icons";
import { formatMoney, formatTimeAgo } from "@/lib/format";
// `import type` is erased at build time, so this doesn't pull the server-only
// module (or Redis) into the browser bundle.
import type { PaymentEvent } from "@/lib/paymentEvents";

const POLL_MS = 10_000;
const TOAST_MS = 6_000;
// Event ids whose toast has been shown, shared by every tab via localStorage.
const SHOWN_KEY = "tab:shown-payment-events";
const SHOWN_MAX = 100;

/** A payment event plus when this tab noticed it, for "just now" / "2 minutes ago". */
type ToastEvent = PaymentEvent & { seenAt: number };

/**
 * Polls /api/events while the dashboard is open. When a new payment event
 * shows up it re-fetches the invoice table (router.refresh) and shows a toast.
 *
 * Two kinds of "already seen":
 *  - `known` (this tab, in memory): events that existed when the page
 *    loaded, plus ones handled since. Prevents toasting old history.
 *  - SHOWN_KEY (all tabs, localStorage): toasts already displayed anywhere,
 *    so a second tab or a reload never repeats one.
 */
export default function LiveInvoiceUpdates() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastEvent[]>([]);

  useEffect(() => {
    let known: Set<string> | null = null; // null until the first poll
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let stopped = false;

    async function poll() {
      clearTimeout(timer);
      if (inFlight || stopped) return;
      // Don't spend requests on a tab nobody is looking at.
      if (document.hidden) return;

      inFlight = true;
      try {
        const res = await fetch("/api/events", { cache: "no-store" });
        if (res.ok && !stopped) handle(((await res.json()) as { events: PaymentEvent[] }).events);
      } catch {
        // Network blip: just try again next tick.
      } finally {
        inFlight = false;
        if (!stopped) timer = setTimeout(poll, POLL_MS);
      }
    }

    function handle(events: PaymentEvent[]) {
      if (known === null) {
        // First poll: everything here happened before the page loaded.
        // The table already reflects it, so remember it and stay quiet.
        known = new Set(events.map((e) => e.id));
        return;
      }

      const fresh = events.filter((e) => !known!.has(e.id));
      if (fresh.length === 0) return;
      fresh.forEach((e) => known!.add(e.id));

      const shown = readShown();
      const toShow = fresh.filter((e) => !shown.includes(e.id)).reverse(); // oldest first
      if (toShow.length > 0) {
        writeShown([...shown, ...toShow.map((e) => e.id)]);
        const seenAt = Math.floor(Date.now() / 1000);
        setToasts((current) => [...current, ...toShow.map((e) => ({ ...e, seenAt }))]);
      }
      // Re-run the server component so the table comes fresh from Stripe.
      router.refresh();
    }

    function onVisibilityChange() {
      if (!document.hidden) poll(); // catch up right away when the tab comes back
    }

    poll();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  const dismiss = (id: string) => setToasts((current) => current.filter((t) => t.id !== id));

  return (
    <div
      aria-live="polite"
      // Bottom-right and out of the page flow, so it never stacks with the
      // "Invoice sent" banner at the top of the dashboard.
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-[22rem]"
    >
      {toasts.map((t) => (
        <Toast key={t.id} event={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({ event, onDismiss }: { event: ToastEvent; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(t);
    // Start the timer once per toast; onDismiss's identity changing on
    // re-render shouldn't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const money = formatMoney(event.amountCents, event.currency, { short: true });
  const ago = formatTimeAgo(event.created, event.seenAt);
  const paid = event.kind === "paid";

  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full items-center gap-3 rounded-card border px-4 py-3.5 shadow-pop motion-safe:animate-toast-in ${
        paid ? "border-aqua bg-aqua-soft" : "border-danger/30 bg-danger-soft"
      }`}
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full ${paid ? "bg-aqua text-navy" : "bg-white text-danger"}`}
      >
        {paid ? <Check /> : <Close />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy">
          {paid ? `${event.clientName} just paid ${money}` : `Payment from ${event.clientName} failed`}
        </p>
        <p className="text-xs text-ink-muted">{paid ? ago : `${money} · ${ago}`}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid size-8 shrink-0 place-items-center rounded-control text-ink-muted transition-colors hover:bg-white/70 hover:text-navy"
      >
        <Close />
      </button>
    </div>
  );
}

// localStorage can throw (private mode, blocked storage), so every access is
// guarded. Worst case without it: a second tab might repeat a toast.
function readShown(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeShown(ids: string[]) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify(ids.slice(-SHOWN_MAX)));
  } catch {
    // ignore
  }
}
