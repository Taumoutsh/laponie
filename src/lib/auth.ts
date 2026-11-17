import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE = 'laponie_session';
const MAX_AGE = 60 * 60 * 24 * 90; // 90 jours

/** La protection par mot de passe est active si APP_PASSWORD est défini. */
export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

function secret(): string {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || 'laponie';
}

/** Jeton de session : change si le mot de passe ou le secret change. */
function sessionToken(): string {
  return createHmac('sha256', secret())
    .update('laponie-session:' + (process.env.APP_PASSWORD ?? ''))
    .digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(input: string): boolean {
  return safeEqual(input, process.env.APP_PASSWORD ?? '');
}

export async function isAuthenticated(): Promise<boolean> {
  if (!authEnabled()) return true;
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  if (!value) return false;
  return safeEqual(value, sessionToken());
}

/** À appeler en tête de chaque page, action serveur et route protégée. */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) redirect('/login');
}

export async function startSession(): Promise<void> {
  const store = await cookies();
  const h = await headers();
  const secure = h.get('x-forwarded-proto') === 'https';
  store.set(COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
