"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
// `import type` is erased at build time, so this doesn't pull the server-only
// module (or Redis) into the browser bundle.
import type { PaymentEvent } from "@/lib/paymentEvents";

const POLL_MS = 10_000;
const TOAST_MS = 6_000;
// Event ids whose toast has been shown, shared by every tab via localStorage.
const SHOWN_KEY = "tab:shown-payment-events";
const SHOWN_MAX = 100;

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
  const [toasts, setToasts] = useState<PaymentEvent[]>([]);

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
        setToasts((current) => [...current, ...toShow]);
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
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-80"
    >
      {toasts.map((t) => (
        <Toast key={t.id} event={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function Toast({ event, onDismiss }: { event: PaymentEvent; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(t);
    // Start the timer once per toast; onDismiss's identity changing on
    // re-render shouldn't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const money = formatMoney(event.amountCents, event.currency, { short: true });
  const paid = event.kind === "paid";
  const message = paid ? `${event.clientName} just paid ${money}.` : `Payment from ${event.clientName} failed (${money}).`;

  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
        paid ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      <p className="flex-1">{message}</p>
      <button onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
        ×
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
