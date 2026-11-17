import { loadEvent } from '@/lib/event-data';
import { deleteEvent, setEventArchived, updateEvent } from '@/app/actions/events';
import { toDateInput } from '@/lib/forms';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { Page } from '@/components/Page';
import { Field, PageHeader, Section } from '@/components/ui';
import { Icon } from '@/components/icons';

export const metadata = { title: 'Réglages' };

export default async function SettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await loadEvent(eventId);
  return (
    <Page crumbs={[{ href: `/events/${eventId}`, label: event.name }, { label: 'Réglages' }]} width="max-w-[720px]">
      <PageHeader icon="settings" title="Réglages" subtitle={event.name} />
      <div className="flex flex-col gap-9">
        <Section title="Informations">
          <ActionForm action={updateEvent.bind(null, eventId)} className="flex flex-col gap-4">
            <Field label="Nom" htmlFor="name">
              <input id="name" name="name" defaultValue={event.name} required className="input" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date de début" htmlFor="startDate">
                <input id="startDate" name="startDate" type="date" defaultValue={toDateInput(event.startDate)} className="input" />
              </Field>
              <Field label="Date de fin" htmlFor="endDate">
                <input id="endDate" name="endDate" type="date" defaultValue={toDateInput(event.endDate)} className="input" />
              </Field>
            </div>
            <div className="flex justify-end">
              <SubmitButton>Enregistrer</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section title="Archivage">
          <form action={setEventArchived.bind(null, eventId, !event.archived)} className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-[13px] text-muted">
              {event.archived
                ? 'Cet événement est archivé : il est rangé en bas de la liste.'
                : 'Archiver range l’événement en bas de la liste, sans rien supprimer.'}
            </p>
            <button type="submit" className="btn">
              <Icon name="archive" size={15} />
              {event.archived ? 'Désarchiver' : 'Archiver'}
            </button>
          </form>
        </Section>

        <Section title="Supprimer l’événement">
          <ActionForm action={deleteEvent.bind(null, eventId)} className="flex flex-col gap-3">
            <p className="text-[13px] text-muted">
              Supprime définitivement l’événement, ses cadeaux, participations, avances et remboursements. Le carnet n’est pas touché.
            </p>
            <Field label={`Recopiez « ${event.name} » pour confirmer`} htmlFor="confirmName">
              <input id="confirmName" name="confirmName" className="input" autoComplete="off" />
            </Field>
            <div>
              <SubmitButton className="btn-danger">
                <Icon name="trash" size={15} />
                Supprimer définitivement
              </SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </Page>
  );
}
