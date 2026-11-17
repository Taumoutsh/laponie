import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-5xl font-bold text-line">404</div>
      <h1 className="text-xl font-semibold">Page introuvable</h1>
      <p className="max-w-sm text-[13px] text-muted">Cet élément a peut-être été supprimé, ou le lien est incorrect.</p>
      <Link href="/" className="btn-primary mt-2">
        Retour à l’accueil
      </Link>
    </main>
  );
}
