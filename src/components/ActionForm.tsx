'use client';

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { ActionState } from '@/lib/forms';

const PendingContext = createContext(false);

/**
 * Formulaire relié à une action serveur qui renvoie un état ({ error } ou { ok }).
 * Les champs ne sont pas vidés en cas d'erreur ; ils le sont après succès si resetOnSuccess.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
  onSuccess,
  id,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  onSuccess?: () => void;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      id={id}
      ref={ref}
      className={className}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(e.currentTarget, submitter ?? undefined);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      {state?.error ? (
        <p role="alert" className="mt-2 basis-full rounded-md bg-danger-bg px-3 py-2 text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function SubmitButton({
  children,
  className = 'btn-primary',
  name,
  value,
  pendingLabel,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  name?: string;
  value?: string;
  pendingLabel?: ReactNode;
  ariaLabel?: string;
}) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" name={name} value={value} className={className} disabled={pending} aria-label={ariaLabel}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
