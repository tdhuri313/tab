/**
 * Shared class strings so buttons, cards, and inputs look the same on every
 * screen. They only use theme tokens from globals.css. Padding and text size
 * are left to each call site (mixing `p-5` with a preset `px-3` is ambiguous
 * in Tailwind, so presets don't set them).
 */

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-control bg-purple font-semibold text-white shadow-button transition-colors hover:bg-purple-hover disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-control border border-line-strong bg-white font-semibold text-navy transition-colors hover:bg-lavender-soft disabled:cursor-not-allowed disabled:opacity-60";

export const btnOutline =
  "inline-flex items-center justify-center gap-2 rounded-control border border-purple bg-white font-semibold text-purple transition-colors hover:bg-lavender-soft disabled:cursor-not-allowed disabled:opacity-60";

export const btnText =
  "inline-flex items-center gap-1.5 rounded-control font-semibold text-purple underline-offset-4 hover:text-purple-hover hover:underline disabled:cursor-not-allowed disabled:opacity-60";

export const card = "rounded-card border border-line bg-white shadow-card";

export const eyebrow = "text-xs font-semibold uppercase tracking-[0.12em]";

export const input =
  "w-full rounded-control border border-line-strong bg-white text-navy placeholder:text-ink-muted transition-colors focus:border-purple aria-invalid:border-danger";
