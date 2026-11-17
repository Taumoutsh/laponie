import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createEvent } from '@/app/actions/events';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { Page } from '@/components/Page';
import { Field, PageHeader } from '@/components/ui';

export const metadata = { title: 'Nouvel événement' };

export default async function NewEventPage() {
  await requireAuth();
  const previous = await prisma.event.findMany({
    orderBy: [{ startDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    select: { id: true, name: true, _count: { select: { participants: true } } },
  });
  return (
    <Page crumbs={[{ href: '/', label: 'Événements' }, { label: 'Nouvel événement' }]} width="max-w-[640px]">
      <PageHeader icon="gift" title="Nouvel événement" subtitle="Noël, un anniversaire, une fête… Les participants viendront du carnet." />
      <ActionForm action={createEvent} className="card flex flex-col gap-4 p-5">
        <Field label="Nom" htmlFor="name">
          <input id="name" name="name" required className="input" placeholder="Noël 2026" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date de début" htmlFor="startDate">
            <input id="startDate" name="startDate" type="date" className="input" />
          </Field>
          <Field label="Date de fin (optionnelle)" htmlFor="endDate">
            <input id="endDate" name="endDate" type="date" className="input" />
          </Field>
        </div>
        {previous.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg bg-soft p-3">
            <Field label="Reprendre les participants d’un événement" htmlFor="copyFrom">
              <select id="copyFrom" name="copyFrom" className="input" defaultValue="">
                <option value="">Non, je les choisirai</option>
                {previous.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e._count.participants} participants)
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="copyCaps" defaultChecked className="h-4 w-4 accent-pine" />
              Reprendre aussi leurs budgets max
            </label>
          </div>
        ) : null}
        <div className="flex justify-end">
          <SubmitButton pendingLabel="Création…">Créer l’événement</SubmitButton>
        </div>
      </ActionForm>
    </Page>
  );
}
