'use client';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="text-[13px] text-muted">
        L’opération n’a pas pu aboutir. Réessayez ; si le problème persiste, consultez les journaux du conteneur.
        {error.digest ? <span className="mt-1 block text-xs">Référence : {error.digest}</span> : null}
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-2">
        Réessayer
      </button>
    </main>
  );
}
