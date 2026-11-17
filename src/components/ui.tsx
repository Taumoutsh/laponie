import Link from 'next/link';
import type { ReactNode } from 'react';
import type { GiftStatus, PurchaseMode } from '@/lib/domain/types';
import { STATUSES, STATUS_LABEL, giftPercent, type Distribution } from '@/lib/domain/status';
import { formatEUR } from '@/lib/domain/money';
import { STATUS_STYLE, avatarColor } from '@/lib/ui';
import { Icon, type IconName } from './icons';

export function Avatar({
  initials,
  color,
  size = 32,
  className = '',
}: {
  initials: string;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  const c = avatarColor(color);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: Math.max(9, Math.round(size * 0.38)) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function AvatarPair({ a, b, size = 26 }: { a: { initials: string; color: string }; b: { initials: string; color: string }; size?: number }) {
  return (
    <span className="inline-flex shrink-0" aria-hidden="true">
      <Avatar initials={a.initials} color={a.color} size={size} className="ring-2 ring-white" />
      <Avatar initials={b.initials} color={b.color} size={size} className="-ml-2 ring-2 ring-white" />
    </span>
  );
}

export function StatusTag({
  status,
  mode,
  withPercent = false,
  className = '',
}: {
  status: GiftStatus;
  mode?: PurchaseMode;
  withPercent?: boolean;
  className?: string;
}) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`tag whitespace-nowrap ${className}`} style={{ background: s.bg, color: s.fg }}>
      {STATUS_LABEL[status]}
      {withPercent && mode ? ` · ${giftPercent(status, mode)} %` : null}
    </span>
  );
}

/** Barre d'avancement globale : couleurs des statuts au prorata du nombre de cadeaux. */
export function StatusBar({
  distribution,
  height = 8,
  gap = 2,
  className = '',
}: {
  distribution: Distribution;
  height?: number;
  gap?: number;
  className?: string;
}) {
  const total = STATUSES.reduce((a, s) => a + distribution[s], 0);
  const label = STATUSES.filter((s) => distribution[s] > 0)
    .map((s) => `${distribution[s]} ${STATUS_LABEL[s].toLowerCase()}`)
    .join(', ');
  return (
    <div
      role="img"
      aria-label={total ? `Répartition des statuts : ${label}` : 'Aucun cadeau'}
      className={`flex w-full overflow-hidden rounded-full bg-line2 ${className}`}
      style={{ height, gap: total ? gap : 0 }}
    >
      {STATUSES.filter((s) => distribution[s] > 0).map((s) => (
        <div key={s} style={{ width: `${(distribution[s] / total) * 100}%`, background: STATUS_STYLE[s].bar }} />
      ))}
    </div>
  );
}

export function StatusLegend({ distribution, className = '' }: { distribution: Distribution; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted ${className}`}>
      {STATUSES.filter((s) => distribution[s] > 0).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ background: STATUS_STYLE[s].bar }} />
          {distribution[s]} {STATUS_LABEL[s].toLowerCase()}
        </span>
      ))}
    </div>
  );
}

export function Meter({ value, max, height = 6, className = '' }: { value: number; max: number | null; height?: number; className?: string }) {
  if (!max || max <= 0) return null;
  const ratio = value / max;
  const color = ratio > 1 ? '#C4342D' : ratio > 0.9 ? '#C98A1B' : '#2F7A5B';
  return (
    <div className={`w-full overflow-hidden rounded-full bg-line2 ${className}`} style={{ height }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, ratio * 100)}%`, background: color }} />
    </div>
  );
}

export function OverChip({ cents }: { cents: number }) {
  if (cents <= 0) return null;
  return <span className="tag bg-danger-bg font-semibold text-danger">+{formatEUR(cents)}</span>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  children,
  href,
  hintClass = 'text-muted',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  href?: string;
  hintClass?: string;
}) {
  const body = (
    <>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-[26px] font-bold leading-tight tabular">{value}</div>
      {children}
      {hint ? <div className={`mt-2 text-xs ${hintClass}`}>{hint}</div> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card block p-4 transition-colors hover:border-[#CFCECA]">
        {body}
      </Link>
    );
  }
  return <div className="card p-4">{body}</div>;
}

export function PageHeader({
  title,
  icon,
  subtitle,
  actions,
  children,
}: {
  title: ReactNode;
  icon?: IconName;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          {icon ? (
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pine-light text-pine">
              <Icon name={icon} size={30} strokeWidth={1.5} />
            </div>
          ) : null}
          <h1 className="text-[30px] font-bold leading-tight tracking-tight md:text-[36px]">{title}</h1>
          {subtitle ? <div className="mt-1.5 text-muted">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function Section({
  title,
  count,
  aside,
  children,
  className = '',
}: {
  title: ReactNode;
  count?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2.5">
        <h2 className="section-title">{title}</h2>
        {count != null ? <span className="text-[13px] text-muted">{count}</span> : null}
        {aside ? <div className="ml-auto flex flex-wrap items-center gap-2">{aside}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Empty({ icon = 'gift', title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[10px] border border-dashed border-[#D3D2CE] px-6 py-10 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-soft text-muted">
        <Icon name={icon} size={20} />
      </span>
      <div className="font-semibold">{title}</div>
      {children ? <div className="mt-1 max-w-md text-[13px] text-muted">{children}</div> : null}
    </div>
  );
}

export function Notice({
  tone = 'info',
  icon,
  children,
  className = '',
}: {
  tone?: 'info' | 'warn' | 'danger' | 'credit' | 'debt' | 'couple' | 'ok';
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'bg-soft text-[#5F5E5B]',
    warn: 'bg-warn-bg text-warn-text',
    danger: 'bg-danger-bg text-danger',
    credit: 'bg-credit-bg text-credit-text',
    debt: 'bg-debt-bg text-debt-text',
    couple: 'bg-couple-bg text-[#7E2347]',
    ok: 'bg-[#E3F1E9] text-[#1F6B45]',
  } as const;
  const defaultIcon: Record<string, IconName> = { info: 'info', warn: 'alert', danger: 'alert', credit: 'scale', debt: 'scale', couple: 'rings', ok: 'check' };
  return (
    <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[13px] ${tones[tone]} ${className}`}>
      <Icon name={icon ?? defaultIcon[tone]} size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Money({ cents, className = '', sign = false }: { cents: number; className?: string; sign?: boolean }) {
  return <span className={`tabular ${className}`}>{formatEUR(cents, { sign })}</span>;
}

export function Field({ label, htmlFor, hint, children, className = '' }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}
