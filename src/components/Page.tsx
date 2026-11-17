import Link from 'next/link';
import type { ReactNode } from 'react';

/** Barre de fil d'Ariane + actions, puis contenu centré. */
export function Page({
  crumbs,
  actions,
  children,
  width = 'max-w-[1120px]',
}: {
  crumbs?: { href?: string; label: string }[];
  actions?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  return (
    <main>
      {crumbs?.length || actions ? (
        <div className="hidden flex-wrap items-center gap-2 border-b border-line2 px-5 py-2.5 md:flex">
          <nav aria-label="Fil d’Ariane" className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
            {crumbs?.map((c, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                {i > 0 ? <span aria-hidden="true">/</span> : null}
                {c.href ? (
                  <Link href={c.href} className="truncate hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-ink">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
          {actions ? <div className="ml-auto flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={`mx-auto px-4 pb-16 pt-6 md:px-10 md:pt-10 ${width}`}>
        {actions ? <div className="mb-4 flex flex-wrap gap-2 md:hidden">{actions}</div> : null}
        {children}
      </div>
    </main>
  );
}
