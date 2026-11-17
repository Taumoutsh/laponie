'use client';

import type { ReactNode } from 'react';

/** Bouton d'envoi qui demande une confirmation avant de soumettre son formulaire. */
export function ConfirmButton({
  message,
  children,
  className = 'btn-ghost',
  ariaLabel,
  name,
  value,
}: {
  message: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  name?: string;
  value?: string;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
