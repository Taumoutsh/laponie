import { redirect } from 'next/navigation';
import { authEnabled, isAuthenticated } from '@/lib/auth';
import { login } from '@/app/actions/auth';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { Icon } from '@/components/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connexion' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!authEnabled() || (await isAuthenticated())) redirect('/');
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-soft px-4">
      <div className="card w-full max-w-sm p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine text-white">
            <Icon name="snow" size={22} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-xl font-bold">Laponie</h1>
            <p className="text-[13px] text-muted">Budget cadeaux</p>
          </div>
        </div>
        <ActionForm action={login} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next ?? '/'} />
          <label htmlFor="password" className="label">
            Mot de passe
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className="input h-11" />
          <SubmitButton className="btn-primary h-11" pendingLabel="Connexion…">
            Entrer
          </SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
