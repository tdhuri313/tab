import Link from "next/link";

/** The "Tab." wordmark bar. Pages pass an optional right-hand link as children. */
export default function SiteHeader({ children, bordered = false }: { children?: React.ReactNode; bordered?: boolean }) {
  return (
    <header className={`w-full ${bordered ? "border-b border-line" : ""}`}>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="rounded-control text-2xl font-bold tracking-tight text-navy">
          Tab.
        </Link>
        {children}
      </div>
    </header>
  );
}
