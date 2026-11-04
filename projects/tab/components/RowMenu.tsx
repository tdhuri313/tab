"use client";

import { useEffect, useRef } from "react";
import { Dots, Download, ExternalLink } from "@/components/icons";

type Props = {
  invoiceId: string;
  clientName: string;
  hostedUrl: string | null;
  pdfUrl: string | null;
};

/**
 * The "···" menu on a dashboard row. Read-only actions only: open Stripe's
 * hosted invoice page, or download the PDF.
 *
 * Built on the native Popover API, which gives us the top layer (so the table's
 * overflow can't clip it), click-outside and Esc to close, and focus back to the
 * button for free. We only have to position it next to the button.
 */
export default function RowMenu({ invoiceId, clientName, hostedUrl, pdfUrl }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = `row-menu-${invoiceId}`;

  useEffect(() => {
    const menu = menuRef.current;
    const button = buttonRef.current;
    if (!menu || !button) return;

    function onToggle(e: Event) {
      if ((e as ToggleEvent).newState !== "open" || !menu || !button) return;
      const r = button.getBoundingClientRect();
      const gap = 6;
      const fitsBelow = r.bottom + gap + menu.offsetHeight <= window.innerHeight;
      menu.style.top = `${fitsBelow ? r.bottom + gap : r.top - gap - menu.offsetHeight}px`;
      menu.style.left = `${Math.max(8, r.right - menu.offsetWidth)}px`;
      menu.querySelector("a")?.focus();
    }
    // A fixed-position menu would drift away from its row, so close on scroll/resize.
    function close() {
      if (menu?.matches(":popover-open")) menu.hidePopover();
    }

    menu.addEventListener("toggle", onToggle);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      menu.removeEventListener("toggle", onToggle);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);

  if (!hostedUrl && !pdfUrl) return null; // drafts: nothing real to offer

  const item =
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-navy hover:bg-lavender-soft focus-visible:bg-lavender-soft";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={menuId}
        aria-label={`More actions for ${clientName}`}
        className="grid size-8 place-items-center rounded-control text-ink-muted transition-colors hover:bg-lavender-soft hover:text-navy"
      >
        <Dots />
      </button>
      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        className="fixed inset-auto m-0 w-48 rounded-control border border-line bg-white p-1.5 shadow-pop"
      >
        {hostedUrl && (
          <a href={hostedUrl} target="_blank" rel="noopener noreferrer" className={item}>
            <ExternalLink className="size-4 text-ink-muted" />
            View invoice
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className={item}>
            <Download className="size-4 text-ink-muted" />
            Download PDF
          </a>
        )}
      </div>
    </>
  );
}
