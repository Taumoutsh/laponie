'use server';

import { redirect } from 'next/navigation';
import { authEnabled, checkPassword, endSession, startSession } from '@/lib/auth';
import { fail, str, type ActionState } from '@/lib/forms';

export async function login(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!authEnabled()) redirect('/');
  const raw = fd.get('password');
  const password = typeof raw === 'string' ? raw : '';
  if (!checkPassword(password)) {
    // ralentit les essais successifs
    await new Promise((r) => setTimeout(r, 700));
    return fail('Mot de passe incorrect.');
  }
  await startSession();
  const next = str(fd, 'next');
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

export async function logout(): Promise<void> {
  await endSession();
  redirect('/login');
}
