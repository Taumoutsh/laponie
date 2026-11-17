'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ActionState } from '@/lib/forms';
import type { GiftStatus, PurchaseMode } from '@/lib/domain/types';
import { STATUS_LABEL, giftPercent, stepsFor } from '@/lib/domain/status';
import { formatEUR, parseMoney } from '@/lib/domain/money';
import { findDuplicates, type DuplicateCandidate } from '@/lib/domain/duplicates';
import { STATUS_STYLE, avatarColor } from '@/lib/ui';
import { ActionForm, SubmitButton } from './ActionForm';
import { Icon } from './icons';

export type GiftFormPerson = { id: string; name: string; firstName: string; initials: string; color: string; group: string };
export type GiftFormCouple = { id: string; label: string };
export type GiftFormCandidate = DuplicateCandidate & {
  status: GiftStatus;
  priceCents: number;
  recipientsLabel: string;
  contributorsLabel: string;
  href: string;
};

export type GiftFormDefaults = {
  name: string;
  url: string;
  price: string;
  status: GiftStatus;
  purchaseMode: PurchaseMode;
  deliveryDate: string;
  note: string;
  recipientIds: string[];
};

type ContribRow = { key: number; party: string; amount: string };
type AdvanceRow = { key: number; payer: string; amount: string; date: string };

export function GiftForm({
  mode,
  action,
  people,
  couples,
  candidates,
  defaults,
  excludeGiftId,
  cancelHref,
}: {
  mode: 'create' | 'edit';
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  people: GiftFormPerson[];
  couples: GiftFormCouple[];
  candidates: GiftFormCandidate[];
  defaults: GiftFormDefaults;
  excludeGiftId?: string;
  cancelHref: string;
}) {
  const [name, setName] = useState(defaults.name);
  const [recipients, setRecipients] = useState<string[]>(defaults.recipientIds);
  const [price, setPrice] = useState(defaults.price);
  const [status, setStatus] = useState<GiftStatus>(defaults.status);
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>(defaults.purchaseMode);
  const [deliveryDate, setDeliveryDate] = useState(defaults.deliveryDate);
  const [url, setUrl] = useState(defaults.url);
  const [note, setNote] = useState(defaults.note);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(defaults.recipientIds.length === 0);
  const [contribs, setContribs] = useState<ContribRow[]>([{ key: 1, party: '', amount: '' }]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [seq, setSeq] = useState(10);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const groups = useMemo(() => {
    const m = new Map<string, GiftFormPerson[]>();
    for (const p of people) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m.entries()];
  }, [people]);

  const matches = useMemo(
    () => findDuplicates(name, recipients, candidates, { excludeId: excludeGiftId, limit: 4 }),
    [name, recipients, candidates, excludeGiftId],
  );
  const showMatches = matches.length > 0 && dismissed !== name.trim().toLowerCase();
  const strong = matches.filter((m) => m.level === 'strong');
  const near = matches.filter((m) => m.level === 'near');

  const priceCents = parseMoney(price) ?? 0;
  const contribTotal = contribs.reduce((a, c) => a + (parseMoney(c.amount) ?? 0), 0);
  const advTotal = advances.reduce((a, c) => a + (parseMoney(c.amount) ?? 0), 0);
  const steps = stepsFor(purchaseMode);

  const toggleRecipient = (id: string) =>
    setRecipients((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const changeMode = (m: PurchaseMode) => {
    setPurchaseMode(m);
    if (m === 'ON_SITE' && status === 'RECEIVED') setStatus('BOUGHT');
  };

  const nextKey = () => {
    setSeq((s) => s + 1);
    return seq;
  };

  return (
    <ActionForm action={action} className="flex flex-col gap-6">
      {recipients.map((id) => (
        <input key={id} type="hidden" name="recipientIds" value={id} />
      ))}
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="purchaseMode" value={purchaseMode} />

      {/* Destinataires */}
      <div className="flex flex-col gap-2">
        <span className="label" id="gf-to-label">
          Pour
        </span>
        <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-[#DAD9D5] px-2 py-1.5" aria-labelledby="gf-to-label">
          {recipients.map((id) => {
            const p = byId.get(id);
            if (!p) return null;
            const c = avatarColor(p.color);
            return (
              <span key={id} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-line2 pl-1 pr-1 text-[13px] font-medium">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: c.bg, color: c.fg }} aria-hidden="true">
                  {p.initials}
                </span>
                {p.name}
                <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-hover" aria-label={`Retirer ${p.name}`} onClick={() => toggleRecipient(id)}>
                  <Icon name="x" size={11} strokeWidth={2.5} />
                </button>
              </span>
            );
          })}
          <button type="button" className="btn-ghost h-7" aria-expanded={showPicker} onClick={() => setShowPicker((v) => !v)}>
            <Icon name={showPicker ? 'chevronDown' : 'plus'} size={13} />
            {recipients.length ? 'Ajouter / retirer' : 'Choisir les destinataires'}
          </button>
        </div>
        {showPicker ? (
          <div className="grid max-h-72 gap-3 overflow-y-auto rounded-lg bg-soft p-3 sm:grid-cols-2">
            {groups.map(([group, members]) => (
              <fieldset key={group}>
                <legend className="mb-1 flex w-full items-center gap-2 text-xs font-semibold text-[#5F5E5B]">
                  {group}
                  {members.length > 1 ? (
                    <button
                      type="button"
                      className="ml-auto text-xs font-medium text-pine hover:underline"
                      onClick={() => {
                        const all = members.every((m) => recipients.includes(m.id));
                        setRecipients((r) => (all ? r.filter((id) => !members.some((m) => m.id === id)) : [...new Set([...r, ...members.map((m) => m.id)])]));
                      }}
                    >
                      {members.every((m) => recipients.includes(m.id)) ? 'Aucun' : 'Tous'}
                    </button>
                  ) : null}
                </legend>
                {members.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[13px] hover:bg-white">
                    <input type="checkbox" className="h-4 w-4 accent-pine" checked={recipients.includes(p.id)} onChange={() => toggleRecipient(p.id)} />
                    {p.name}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        ) : null}
        {recipients.length > 1 && priceCents > 0 ? (
          <span className="text-xs text-muted">Parts égales : {formatEUR(Math.round(priceCents / recipients.length))} environ chacun.</span>
        ) : null}
      </div>

      {/* Nom + doublons */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gf-name" className="label">
          Nom du cadeau
        </label>
        <input
          id="gf-name"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`input h-11 text-base font-medium ${showMatches && strong.length ? 'border-warn ring-2 ring-warn/30' : ''}`}
          autoComplete="off"
        />
        {showMatches ? (
          <div role="status" className={`mt-2 rounded-[10px] border p-3.5 ${strong.length ? 'border-[#F0DFAE] bg-[#FFFBF0]' : 'border-line bg-soft'}`}>
            <div className={`flex items-center gap-2 text-[13px] font-semibold ${strong.length ? 'text-warn-text' : 'text-[#5F5E5B]'}`}>
              <Icon name={strong.length ? 'alert' : 'info'} size={16} />
              {strong.length
                ? `${recipients.length > 1 ? 'Un destinataire a' : `${byId.get(strong[0].sharedRecipientIds[0])?.firstName ?? 'Ce destinataire'} a`} peut-être déjà ce cadeau`
                : 'Cadeaux proches déjà prévus ou offerts'}
            </div>
            <ul className="mt-2.5 flex flex-col gap-2">
              {[...strong, ...near].map((m) => (
                <li key={m.candidate.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-[#EEE3C2]/60 bg-white px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{m.candidate.name}</div>
                    <div className="text-xs text-muted">
                      pour {m.candidate.recipientsLabel}
                      {m.candidate.contributorsLabel ? ` · de ${m.candidate.contributorsLabel}` : ''}
                      {!m.candidate.current && m.candidate.eventName ? ` · ${m.candidate.eventName}` : ''}
                    </div>
                  </div>
                  {m.level === 'near' ? <span className="tag bg-line2 text-muted">{m.candidate.current ? 'Proche' : 'Déjà offert'}</span> : null}
                  <span className="tag" style={{ background: STATUS_STYLE[m.candidate.status].bg, color: STATUS_STYLE[m.candidate.status].fg }}>
                    {STATUS_LABEL[m.candidate.status]}
                  </span>
                  <span className="font-semibold tabular">{formatEUR(m.candidate.priceCents)}</span>
                  {m.candidate.current ? (
                    <span className="flex gap-1.5">
                      <Link href={`${m.candidate.href}#participer`} className="btn-primary h-8 px-2.5">
                        Participer à ce cadeau
                      </Link>
                      <Link href={m.candidate.href} className="btn h-8 px-2.5">
                        Ouvrir
                      </Link>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <button type="button" className="btn-ghost mt-2" onClick={() => setDismissed(name.trim().toLowerCase())}>
              C’est un autre cadeau, continuer
            </button>
          </div>
        ) : null}
      </div>

      {/* Prix + lien */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gf-price" className="label">
            Prix
          </label>
          <input id="gf-price" name="price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0,00 €" className="input tabular" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gf-url" className="label">
            Lien <span className="font-normal text-muted">(optionnel)</span>
          </label>
          <input id="gf-url" name="url" value={url} onChange={(e) => setUrl(e.target.value)} type="url" placeholder="https://" className="input" />
        </div>
      </div>

      {/* Mode d'achat + statut */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="label">Mode d’achat</span>
          <div className="segmented w-max" role="group" aria-label="Mode d’achat">
            {(['ON_SITE', 'REMOTE'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={purchaseMode === m} onClick={() => changeMode(m)}>
                <Icon name={m === 'ON_SITE' ? 'store' : 'truck'} size={14} />
                {m === 'ON_SITE' ? 'Sur place' : 'À distance'}
              </button>
            ))}
          </div>
        </div>
        {purchaseMode === 'REMOTE' ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gf-delivery" className="label">
              Livraison prévue
            </label>
            <input id="gf-delivery" name="deliveryDate" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="input" />
          </div>
        ) : (
          <p className="self-end text-xs text-muted">Sur place : pas d’étape « Reçu ».</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="label">Statut</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Statut">
          {steps.map((s) => {
            const on = status === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setStatus(s)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px]"
                style={
                  on
                    ? { background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].fg, borderColor: STATUS_STYLE[s].fg, fontWeight: 600 }
                    : { borderColor: '#E3E2DF', color: '#5F5E5B' }
                }
              >
                {STATUS_LABEL[s]}
                <span className="text-[11px] opacity-80">{giftPercent(s, purchaseMode)} %</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="gf-note" className="label">
          Note <span className="font-normal text-muted">(optionnelle)</span>
        </label>
        <input id="gf-note" name="note" value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Taille, couleur, magasin…" />
      </div>

      {mode === 'create' ? (
        <>
          {/* Participations */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="label">Participations</span>
              <span className="ml-auto text-xs text-muted">
                Reste à financer{' '}
                <b className={priceCents - contribTotal > 0 ? 'text-warn-text' : priceCents - contribTotal < 0 ? 'text-danger' : 'text-[#1F6B45]'}>
                  {formatEUR(priceCents - contribTotal)}
                </b>
              </span>
            </div>
            <div className="rounded-lg border border-line">
              {contribs.map((row, i) => (
                <div key={row.key} className={`flex flex-wrap items-end gap-2 px-3 py-2.5 ${i ? 'border-t border-line2' : ''}`}>
                  <div className="flex min-w-[180px] flex-1 flex-col gap-1">
                    <label htmlFor={`gf-cp-${row.key}`} className="text-xs text-muted">
                      Qui participe
                    </label>
                    <select
                      id={`gf-cp-${row.key}`}
                      name="contribParty"
                      value={row.party}
                      onChange={(e) => setContribs((rows) => rows.map((r) => (r.key === row.key ? { ...r, party: e.target.value } : r)))}
                      className="input"
                    >
                      <option value="">Choisir…</option>
                      {couples.length ? (
                        <optgroup label="Couples">
                          {couples.map((c) => (
                            <option key={c.id} value={`c:${c.id}`}>
                              {c.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      <optgroup label="Personnes">
                        {people.map((p) => (
                          <option key={p.id} value={`p:${p.id}`}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="flex w-32 flex-col gap-1">
                    <label htmlFor={`gf-ca-${row.key}`} className="text-xs text-muted">
                      Montant
                    </label>
                    <input
                      id={`gf-ca-${row.key}`}
                      name="contribAmount"
                      value={row.amount}
                      onChange={(e) => setContribs((rows) => rows.map((r) => (r.key === row.key ? { ...r, amount: e.target.value } : r)))}
                      inputMode="decimal"
                      placeholder="0,00"
                      className="input text-right tabular"
                    />
                  </div>
                  <button
                    type="button"
                    className="icon-btn h-9 w-9"
                    aria-label="Retirer la participation"
                    onClick={() => setContribs((rows) => rows.filter((r) => r.key !== row.key))}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-1 border-t border-line2 px-2 py-1.5">
                <button type="button" className="btn-ghost" onClick={() => setContribs((rows) => [...rows, { key: nextKey(), party: '', amount: '' }])}>
                  <Icon name="plus" size={14} />
                  Ajouter une personne ou un couple
                </button>
                {priceCents - contribTotal > 0 && contribs.length > 0 ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const last = contribs[contribs.length - 1];
                      const current = parseMoney(last.amount) ?? 0;
                      const v = ((current + priceCents - contribTotal) / 100).toFixed(2).replace('.', ',');
                      setContribs((rows) => rows.map((r) => (r.key === last.key ? { ...r, amount: v } : r)));
                    }}
                  >
                    Compléter avec la dernière ligne
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Avances */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="label">Avance</span>
              <span className="text-xs text-muted">Qui a payé le cadeau en attendant les remboursements ?</span>
              {advances.length ? (
                <span className="ml-auto text-xs text-muted">
                  Avancé <b className="text-credit-text">{formatEUR(advTotal)}</b> / {formatEUR(priceCents)}
                </span>
              ) : null}
            </div>
            <div className="rounded-lg border border-line">
              {advances.map((row, i) => (
                <div key={row.key} className={`flex flex-wrap items-end gap-2 px-3 py-2.5 ${i ? 'border-t border-line2' : ''}`}>
                  <div className="flex min-w-[170px] flex-1 flex-col gap-1">
                    <label htmlFor={`gf-ap-${row.key}`} className="text-xs text-muted">
                      Payé par
                    </label>
                    <select
                      id={`gf-ap-${row.key}`}
                      name="advPayer"
                      value={row.payer}
                      onChange={(e) => setAdvances((rows) => rows.map((r) => (r.key === row.key ? { ...r, payer: e.target.value } : r)))}
                      className="input"
                    >
                      <option value="">Choisir…</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex w-28 flex-col gap-1">
                    <label htmlFor={`gf-aa-${row.key}`} className="text-xs text-muted">
                      Montant
                    </label>
                    <input
                      id={`gf-aa-${row.key}`}
                      name="advAmount"
                      value={row.amount}
                      onChange={(e) => setAdvances((rows) => rows.map((r) => (r.key === row.key ? { ...r, amount: e.target.value } : r)))}
                      inputMode="decimal"
                      className="input text-right tabular"
                    />
                  </div>
                  <div className="flex w-36 flex-col gap-1">
                    <label htmlFor={`gf-ad-${row.key}`} className="text-xs text-muted">
                      Le
                    </label>
                    <input
                      id={`gf-ad-${row.key}`}
                      name="advDate"
                      type="date"
                      value={row.date}
                      onChange={(e) => setAdvances((rows) => rows.map((r) => (r.key === row.key ? { ...r, date: e.target.value } : r)))}
                      className="input"
                    />
                  </div>
                  <button
                    type="button"
                    className="icon-btn h-9 w-9"
                    aria-label="Retirer l’avance"
                    onClick={() => setAdvances((rows) => rows.filter((r) => r.key !== row.key))}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
              <div className="px-2 py-1.5">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    setAdvances((rows) => [
                      ...rows,
                      {
                        key: nextKey(),
                        payer: '',
                        amount: rows.length === 0 && priceCents ? (priceCents / 100).toFixed(2).replace('.', ',') : '',
                        date: new Date().toISOString().slice(0, 10),
                      },
                    ])
                  }
                >
                  <Icon name="plus" size={14} />
                  {advances.length ? 'Ajouter une autre avance' : 'Quelqu’un a avancé l’argent'}
                </button>
              </div>
            </div>
            {advances.length ? (
              <p className="flex items-start gap-2 rounded-lg bg-credit-bg px-3 py-2.5 text-[13px] text-credit-text">
                <Icon name="scale" size={16} className="mt-0.5 shrink-0" />
                Chaque participant devra rembourser sa part à la personne qui a avancé. Ces dettes apparaîtront dans les balances.
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line2 pt-4">
        <Link href={cancelHref} className="btn-ghost h-9">
          Annuler
        </Link>
        <SubmitButton pendingLabel="Enregistrement…">{mode === 'create' ? 'Créer le cadeau' : 'Enregistrer'}</SubmitButton>
      </div>
    </ActionForm>
  );
}
