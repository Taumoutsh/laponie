import Link from 'next/link';
import { loadCarnet } from '@/lib/event-data';
import {
  addFamilyMember,
  createCouple,
  createFamily,
  deleteCouple,
  deleteFamily,
  removeFamilyMember,
  renameFamily,
  updateCouple,
} from '@/app/actions/carnet';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Page } from '@/components/Page';
import { Avatar, AvatarPair, Empty, Field, Notice, PageHeader, Section } from '@/components/ui';
import { Icon } from '@/components/icons';
import { avatarColor } from '@/lib/ui';

export const metadata = { title: 'Familles & couples' };

function SplitInputs({ idPrefix, splitA, nameA, nameB }: { idPrefix: string; splitA: number; nameA: string; nameB: string }) {
  const presets = [50, 60, 70];
  const isPreset = presets.includes(splitA);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="label mb-2">Répartition des dépenses communes (part de {nameA})</legend>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <label key={p} className="cursor-pointer">
            <input type="radio" name="splitPreset" value={p} defaultChecked={splitA === p} className="peer sr-only" />
            <span className="inline-flex h-8 items-center rounded-md border border-[#E3E2DF] px-3 text-[13px] peer-checked:border-pine peer-checked:bg-pine-light peer-checked:font-semibold peer-checked:text-pine peer-focus-visible:ring-2 peer-focus-visible:ring-pine">
              {p} / {100 - p}
            </span>
          </label>
        ))}
        <label className="cursor-pointer">
          <input type="radio" name="splitPreset" value="custom" defaultChecked={!isPreset} className="peer sr-only" />
          <span className="inline-flex h-8 items-center rounded-md border border-[#E3E2DF] px-3 text-[13px] peer-checked:border-pine peer-checked:bg-pine-light peer-checked:font-semibold peer-checked:text-pine peer-focus-visible:ring-2 peer-focus-visible:ring-pine">
            Autre
          </span>
        </label>
      </div>
      <div className="flex items-center gap-2 text-[13px]">
        <label htmlFor={`${idPrefix}-split`}>Autre : part de {nameA}</label>
        <input id={`${idPrefix}-split`} name="splitA" type="number" min={0} max={100} defaultValue={splitA} className="input h-8 w-20" />
        <span className="text-muted">% (le reste pour {nameB})</span>
      </div>
    </fieldset>
  );
}

export default async function FamiliesPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a: preA, b: preB } = await searchParams;
  const { persons, families, couples, directory: dir } = await loadCarnet();
  const inCouple = new Set(couples.flatMap((c) => [c.personAId, c.personBId]));
  const single = persons.filter((p) => !inCouple.has(p.id));
  const thisYear = new Date().getFullYear();

  // Suggestions : familles avec exactement deux adultes sans couple
  const suggestions = families
    .map((f) => {
      const adults = persons.filter(
        (p) => p.familyId === f.id && !inCouple.has(p.id) && (p.birthYear == null || thisYear - p.birthYear >= 18),
      );
      return adults.length === 2 ? { family: f, a: adults[0], b: adults[1] } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const sortedSingles = [...single].sort((x, y) => dir.personName(x.id).localeCompare(dir.personName(y.id), 'fr'));

  return (
    <Page
      crumbs={[{ label: 'Carnet' }, { label: 'Familles & couples' }]}
      actions={
        <Link href="/people" className="btn">
          <Icon name="users" size={15} />
          Personnes
        </Link>
      }
    >
      <PageHeader
        icon="rings"
        title="Familles & couples"
        subtitle="Un couple participe ensemble aux cadeaux et partage ses dépenses selon une répartition. Une famille permet d’ajouter tous ses membres d’un coup à un événement."
      />

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-9">
          {/* ---------- Couples ---------- */}
          <Section title="Couples" count={couples.length}>
            {couples.length === 0 ? (
              <p className="text-[13px] text-muted">Aucun couple pour l’instant.</p>
            ) : (
              <ul className="overflow-hidden rounded-[10px] border border-line">
                {couples.map((c, i) => {
                  const pa = dir.person(c.personAId)!;
                  const pb = dir.person(c.personBId)!;
                  return (
                    <li key={c.id} className={i ? 'border-t border-line2' : ''}>
                      <details className="group">
                        <summary className="row-link flex cursor-pointer list-none flex-wrap items-center gap-3 px-3.5 py-3">
                          <AvatarPair
                            a={{ initials: dir.initials(pa.id), color: pa.color }}
                            b={{ initials: dir.initials(pb.id), color: pb.color }}
                            size={30}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold">{dir.coupleFullName(c.id)}</div>
                            <div className="text-xs text-muted">{pa.familyId ? dir.family(pa.familyId)?.name : 'Sans famille'}</div>
                          </div>
                          <div className="w-36">
                            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                              <div style={{ width: `${c.splitA}%`, background: avatarColor(pa.color).fg }} />
                              <div className="flex-1" style={{ background: avatarColor(pb.color).fg }} />
                            </div>
                            <div className="mt-1 text-xs text-[#5F5E5B] tabular">
                              {pa.firstName} {c.splitA} % · {pb.firstName} {100 - c.splitA} %
                            </div>
                          </div>
                          <span className="w-32 text-xs text-[#5F5E5B]">{c.sharedAccount ? 'Compte commun' : 'Comptes séparés'}</span>
                          <Icon name="pencil" size={14} className="text-muted" />
                        </summary>
                        <div className="border-t border-line2 bg-soft px-3.5 py-3">
                          <ActionForm action={updateCouple.bind(null, c.id)} className="flex flex-col gap-3">
                            <SplitInputs idPrefix={`c-${c.id}`} splitA={c.splitA} nameA={pa.firstName} nameB={pb.firstName} />
                            <label className="flex items-center gap-2 text-[13px]">
                              <input type="checkbox" name="sharedAccount" defaultChecked={c.sharedAccount} className="h-4 w-4 accent-pine" />
                              Compte commun : avances et dettes du couple regroupées dans les balances
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <SubmitButton>Enregistrer</SubmitButton>
                            </div>
                          </ActionForm>
                          <ActionForm action={deleteCouple.bind(null, c.id)} className="mt-2">
                            <ConfirmButton message={`Séparer ${dir.coupleShortName(c.id)} ?`} className="btn-ghost text-danger">
                              <Icon name="trash" size={14} />
                              Séparer ce couple
                            </ConfirmButton>
                          </ActionForm>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
            {suggestions.map((s) => (
              <Notice key={s.family.id} tone="couple" className="mt-3">
                Suggestion : <b>{dir.personName(s.a.id)}</b> et <b>{dir.personName(s.b.id)}</b> sont deux adultes de la {s.family.name}, sans couple.{' '}
                <Link href={`/families?a=${s.a.id}&b=${s.b.id}#couple-form`} className="font-semibold underline underline-offset-2">
                  Former ce couple
                </Link>
              </Notice>
            ))}
          </Section>

          {/* ---------- Familles ---------- */}
          <Section title="Familles" count={families.length}>
            {families.length === 0 ? (
              <Empty icon="users" title="Aucune famille">
                Créez une famille pour ajouter tous ses membres d’un coup à un événement.
              </Empty>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                {families.map((f) => {
                  const members = persons.filter((p) => p.familyId === f.id);
                  const others = persons.filter((p) => p.familyId !== f.id);
                  return (
                    <div key={f.id} className="card p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{f.name}</span>
                        <span className="text-xs text-muted">{members.length} pers.</span>
                      </div>
                      <ul className="mt-2 flex flex-col gap-1">
                        {members.map((m) => (
                          <li key={m.id} className="flex items-center gap-2 rounded-md bg-soft px-2 py-1">
                            <Avatar initials={dir.initials(m.id)} color={m.color} size={22} />
                            <span className="min-w-0 flex-1 truncate text-[13px]">
                              {dir.personName(m.id)}
                              {inCouple.has(m.id) ? <Icon name="rings" size={11} strokeWidth={2} className="ml-1 inline text-couple" label="en couple" /> : null}
                            </span>
                            <ActionForm action={removeFamilyMember.bind(null, m.id)}>
                              <SubmitButton className="icon-btn h-7 w-7" ariaLabel={`Retirer ${m.firstName} de la famille`}>
                                <Icon name="x" size={13} />
                              </SubmitButton>
                            </ActionForm>
                          </li>
                        ))}
                      </ul>
                      {others.length > 0 ? (
                        <ActionForm action={addFamilyMember.bind(null, f.id)} className="mt-2 flex gap-1.5">
                          <label htmlFor={`add-${f.id}`} className="sr-only">
                            Ajouter un membre
                          </label>
                          <select id={`add-${f.id}`} name="personId" className="input h-8 text-[13px]" defaultValue="">
                            <option value="" disabled>
                              Ajouter un membre…
                            </option>
                            {others.map((p) => (
                              <option key={p.id} value={p.id}>
                                {dir.personName(p.id)}
                                {p.familyId ? ` (${dir.family(p.familyId)?.name})` : ''}
                              </option>
                            ))}
                          </select>
                          <SubmitButton className="btn h-8 px-2.5" ariaLabel="Ajouter à la famille">
                            <Icon name="plus" size={14} />
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-muted hover:text-ink">Renommer ou supprimer</summary>
                        <ActionForm action={renameFamily.bind(null, f.id)} className="mt-2 flex gap-1.5">
                          <label htmlFor={`rename-${f.id}`} className="sr-only">
                            Nom de la famille
                          </label>
                          <input id={`rename-${f.id}`} name="name" defaultValue={f.name} className="input h-8 text-[13px]" />
                          <SubmitButton className="btn h-8">OK</SubmitButton>
                        </ActionForm>
                        <ActionForm action={deleteFamily.bind(null, f.id)} className="mt-1">
                          <ConfirmButton message={`Supprimer ${f.name} ? Ses membres restent dans le carnet.`} className="btn-ghost h-7 text-danger">
                            <Icon name="trash" size={13} />
                            Supprimer la famille
                          </ConfirmButton>
                        </ActionForm>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
            <ActionForm action={createFamily} resetOnSuccess className="mt-4 flex flex-wrap items-end gap-2">
              <Field label="Nouvelle famille" htmlFor="new-family" className="min-w-[200px] flex-1">
                <input id="new-family" name="name" placeholder="Famille Petit" className="input" required />
              </Field>
              <SubmitButton className="btn">
                <Icon name="plus" size={15} />
                Créer
              </SubmitButton>
            </ActionForm>
          </Section>
        </div>

        {/* ---------- Former un couple ---------- */}
        <aside id="couple-form" className="card overflow-hidden shadow-[0_8px_28px_rgba(15,15,15,0.06)] lg:sticky lg:top-6">
          <div className="flex items-center gap-2 border-b border-line2 px-4 py-3.5">
            <Icon name="rings" size={17} strokeWidth={2} className="text-couple" />
            <h2 className="font-semibold">Former un couple</h2>
          </div>
          {sortedSingles.length < 2 ? (
            <p className="p-4 text-[13px] text-muted">Il faut au moins deux personnes sans couple dans le carnet.</p>
          ) : (
            <ActionForm action={createCouple} resetOnSuccess className="flex flex-col gap-4 p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
                <Field label="Personne 1" htmlFor="cp-a">
                  <select id="cp-a" name="personAId" className="input" defaultValue={preA ?? ''} required>
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {sortedSingles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {dir.personName(p.id)}
                      </option>
                    ))}
                  </select>
                </Field>
                <span aria-hidden="true" className="flex h-9 items-center font-bold text-couple">
                  &amp;
                </span>
                <Field label="Personne 2" htmlFor="cp-b">
                  <select id="cp-b" name="personBId" className="input" defaultValue={preB ?? ''} required>
                    <option value="" disabled>
                      Choisir…
                    </option>
                    {sortedSingles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {dir.personName(p.id)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <SplitInputs idPrefix="new" splitA={50} nameA="la personne 1" nameB="la personne 2" />
              <label className="flex items-start gap-2 text-[13px]">
                <input type="checkbox" name="sharedAccount" defaultChecked className="mt-0.5 h-4 w-4 accent-pine" />
                <span>Compte commun : les avances et dettes du couple sont regroupées dans les balances</span>
              </label>
              <Field label="Famille (optionnelle)" htmlFor="cp-fam" hint="Rattache les deux personnes à cette famille.">
                <select id="cp-fam" name="familyId" className="input" defaultValue="">
                  <option value="">Ne pas changer</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Notice tone="info">Une participation de 100 € du couple compte, à 50 / 50, pour 50 € chacun dans les dépenses et les plafonds.</Notice>
              <SubmitButton pendingLabel="Création…">Créer le couple</SubmitButton>
            </ActionForm>
          )}
        </aside>
      </div>
    </Page>
  );
}
