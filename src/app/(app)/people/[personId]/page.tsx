import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { loadCarnet } from '@/lib/event-data';
import { deletePerson, updatePerson } from '@/app/actions/carnet';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Page } from '@/components/Page';
import { PersonFields } from '@/components/PersonFields';
import { Avatar, PageHeader, Section } from '@/components/ui';
import { Icon } from '@/components/icons';
import { formatEUR } from '@/lib/domain/money';

export default async function PersonPage({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  const { families, directory: dir } = await loadCarnet();
  const person = dir.person(personId);
  if (!person) notFound();
  const note = (await prisma.person.findUnique({ where: { id: personId }, select: { note: true } }))?.note ?? null;
  const participations = await prisma.eventParticipant.findMany({
    where: { personId },
    include: { event: true },
    orderBy: { event: { createdAt: 'desc' } },
  });
  const partner = dir.partnerOf(personId);

  return (
    <Page crumbs={[{ href: '/people', label: 'Personnes' }, { label: dir.personName(personId) }]} width="max-w-[900px]">
      <PageHeader
        title={
          <span className="flex items-center gap-4">
            <Avatar initials={dir.initials(personId)} color={person.color} size={56} />
            {dir.personName(personId)}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap gap-2 pt-1">
            {person.familyId ? <span className="tag bg-line2 text-ink">{dir.family(person.familyId)?.name}</span> : null}
            {partner ? (
              <Link href="/families" className="tag bg-couple-bg text-couple">
                <Icon name="rings" size={12} strokeWidth={2} />
                En couple avec {dir.personName(partner.id)}
              </Link>
            ) : null}
          </span>
        }
      />

      <div className="flex flex-col gap-8">
        <Section title="Informations">
          <ActionForm action={updatePerson.bind(null, personId)} className="flex flex-col gap-4">
            <PersonFields families={families} defaults={{ ...person, note }} idPrefix="edit" />
            <div className="flex justify-end">
              <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section title="Événements" count={participations.length}>
          {participations.length === 0 ? (
            <p className="text-[13px] text-muted">Cette personne ne participe encore à aucun événement.</p>
          ) : (
            <ul className="overflow-hidden rounded-[10px] border border-line">
              {participations.map((p, i) => (
                <li key={p.id} className={i ? 'border-t border-line2' : ''}>
                  <Link href={`/events/${p.eventId}/people/${personId}`} className="row-link flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                    <Icon name="gift" size={16} className="text-muted" />
                    <span className="font-medium">{p.event.name}</span>
                    <span className="ml-auto text-xs text-muted">
                      Reçu max {p.receiveMaxCents != null ? formatEUR(p.receiveMaxCents) : '—'} · Dépense max{' '}
                      {p.spendMaxCents != null ? formatEUR(p.spendMaxCents) : '—'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Supprimer">
          <ActionForm action={deletePerson.bind(null, personId)} className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-[13px] text-muted">
              Possible uniquement si la personne n’a ni cadeau, ni participation, ni avance, ni remboursement.
            </p>
            <ConfirmButton message={`Supprimer ${dir.personName(personId)} du carnet ?`} className="btn-danger">
              <Icon name="trash" size={15} />
              Supprimer du carnet
            </ConfirmButton>
          </ActionForm>
        </Section>
      </div>
    </Page>
  );
}
