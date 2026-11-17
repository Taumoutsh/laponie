import Link from 'next/link';
import { loadEvent } from '@/lib/event-data';
import { addParticipants, removeParticipant, updateParticipant } from '@/app/actions/events';
import { createPerson } from '@/app/actions/carnet';
import { centsToInput, formatEUR } from '@/lib/domain/money';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Page } from '@/components/Page';
import { ParticipantPicker } from '@/components/ParticipantPicker';
import { PersonFields } from '@/components/PersonFields';
import { Avatar, Field, OverChip, PageHeader, Section } from '@/components/ui';
import { Icon } from '@/components/icons';

export const metadata = { title: 'Participants' };

export default async function ParticipantsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, data, dir, stats, groups, participantIds } = await loadEvent(eventId);

  const pickerGroups = [
    ...data.families.map((f) => ({ key: f.id, name: f.name, people: data.persons.filter((p) => p.familyId === f.id) })),
    { key: 'none', name: 'Sans famille', people: data.persons.filter((p) => !p.familyId) },
  ]
    .filter((g) => g.people.length > 0)
    .map((g) => ({
      key: g.key,
      name: g.name,
      people: g.people.map((p) => ({
        id: p.id,
        name: dir.personName(p.id),
        initials: dir.initials(p.id),
        color: p.color,
        inEvent: participantIds.has(p.id),
        couple: dir.partnerOf(p.id)?.firstName ?? null,
        age: dir.age(p.id),
      })),
    }));
  const missing = data.persons.length - participantIds.size;

  return (
    <Page crumbs={[{ href: `/events/${eventId}`, label: event.name }, { label: 'Participants' }]}>
      <PageHeader icon="userPlus" title="Participants" subtitle={`Qui est concerné par ${event.name}, et avec quels budgets.`} />

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Section title="Dans l’événement" count={participantIds.size}>
          {groups.length === 0 ? (
            <p className="text-[13px] text-muted">Personne pour l’instant : sélectionnez des personnes dans le carnet.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((g) => (
                <div key={g.key}>
                  <div className="mb-1.5 text-[13px] font-semibold">{g.name}</div>
                  <ul className="overflow-hidden rounded-[10px] border border-line">
                    {g.memberIds.map((id, i) => {
                      const s = stats.get(id)!;
                      return (
                        <li key={id} className={`px-3 py-2.5 ${i ? 'border-t border-line2' : ''}`}>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <Link href={`/events/${eventId}/people/${id}`} className="flex min-w-[170px] flex-1 items-center gap-2.5">
                              <Avatar initials={dir.initials(id)} color={dir.person(id)?.color} size={30} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium">{dir.personName(id)}</span>
                                <span className="text-xs text-muted">
                                  reçoit {formatEUR(s.receivedCents)} · dépense {formatEUR(s.spentCents)}
                                </span>
                              </span>
                            </Link>
                            <ActionForm action={updateParticipant.bind(null, eventId, id)} className="flex flex-wrap items-end gap-2">
                              <div className="flex flex-col gap-0.5">
                                <label htmlFor={`r-${id}`} className="text-[11px] text-muted">
                                  Reçu max
                                </label>
                                <input id={`r-${id}`} name="receiveMax" defaultValue={centsToInput(s.receiveMaxCents)} placeholder="—" inputMode="decimal" className="input h-8 w-24 text-right tabular" />
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <label htmlFor={`s-${id}`} className="text-[11px] text-muted">
                                  Dépense max
                                </label>
                                <input id={`s-${id}`} name="spendMax" defaultValue={centsToInput(s.spendMaxCents)} placeholder="aucun" inputMode="decimal" className="input h-8 w-24 text-right tabular" />
                              </div>
                              <SubmitButton className="btn h-8 px-2.5" ariaLabel={`Enregistrer les budgets de ${dir.firstName(id)}`}>
                                <Icon name="check" size={14} />
                              </SubmitButton>
                            </ActionForm>
                            <ActionForm action={removeParticipant.bind(null, eventId, id)}>
                              <ConfirmButton message={`Retirer ${dir.personName(id)} de ${event.name} ?`} className="icon-btn" ariaLabel={`Retirer ${dir.firstName(id)}`}>
                                <Icon name="x" size={15} />
                              </ConfirmButton>
                            </ActionForm>
                          </div>
                          {s.overReceiveCents > 0 || s.overSpendCents > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-2 pl-10 text-xs text-danger">
                              {s.overReceiveCents > 0 ? (
                                <span className="flex items-center gap-1">
                                  Reçu <OverChip cents={s.overReceiveCents} />
                                </span>
                              ) : null}
                              {s.overSpendCents > 0 ? (
                                <span className="flex items-center gap-1">
                                  Dépense <OverChip cents={s.overSpendCents} />
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <aside className="card p-4">
            <h2 className="mb-3 font-semibold">Ajouter depuis le carnet</h2>
            {missing === 0 ? (
              <p className="text-[13px] text-muted">
                Tout le carnet participe déjà. <Link href="/people" className="text-pine underline">Ajouter quelqu’un au carnet</Link>
              </p>
            ) : (
              <ActionForm action={addParticipants.bind(null, eventId)} resetOnSuccess className="flex flex-col gap-4">
                <ParticipantPicker key={participantIds.size} groups={pickerGroups} />
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-soft p-3">
                  <Field label="Reçu max" htmlFor="def-recv" hint="Pour toute la sélection">
                    <input id="def-recv" name="receiveMax" placeholder="ex. 200" inputMode="decimal" className="input" />
                  </Field>
                  <Field label="Dépense max" htmlFor="def-spend" hint="Optionnel">
                    <input id="def-spend" name="spendMax" placeholder="aucun" inputMode="decimal" className="input" />
                  </Field>
                </div>
                <SubmitButton pendingLabel="Ajout…">Ajouter la sélection</SubmitButton>
              </ActionForm>
            )}
          </aside>

          <details className="card p-4">
            <summary className="cursor-pointer font-semibold">Nouvelle personne (carnet + événement)</summary>
            <ActionForm action={createPerson} resetOnSuccess className="mt-3 flex flex-col gap-4">
              <input type="hidden" name="addToEventId" value={eventId} />
              <PersonFields families={data.families} idPrefix="np" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Reçu max" htmlFor="np-recv">
                  <input id="np-recv" name="receiveMax" inputMode="decimal" className="input" />
                </Field>
                <Field label="Dépense max" htmlFor="np-spend">
                  <input id="np-spend" name="spendMax" inputMode="decimal" placeholder="aucun" className="input" />
                </Field>
              </div>
              <SubmitButton>Créer et ajouter</SubmitButton>
            </ActionForm>
          </details>
        </div>
      </div>
    </Page>
  );
}
