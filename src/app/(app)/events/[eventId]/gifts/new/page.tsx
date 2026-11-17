import Link from 'next/link';
import { loadEvent } from '@/lib/event-data';
import { giftFormData } from '@/lib/gift-form-data';
import { createGift } from '@/app/actions/gifts';
import { GiftForm } from '@/components/GiftForm';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';

export const metadata = { title: 'Nouveau cadeau' };

export default async function NewGiftPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ for?: string | string[] }>;
}) {
  const { eventId } = await params;
  const sp = await searchParams;
  const view = await loadEvent(eventId);
  const { people, couples, candidates } = await giftFormData(view);
  const pre = (Array.isArray(sp.for) ? sp.for : sp.for ? [sp.for] : []).filter((id) => view.participantIds.has(id));

  return (
    <Page crumbs={[{ href: `/events/${eventId}`, label: view.event.name }, { href: `/events/${eventId}/gifts`, label: 'Cadeaux' }, { label: 'Nouveau' }]} width="max-w-[780px]">
      <PageHeader icon="gift" title="Nouveau cadeau" subtitle={view.event.name} />
      {people.length === 0 ? (
        <Empty icon="userPlus" title="Ajoutez d’abord des participants">
          Un cadeau est offert à des participants de l’événement.
          <div className="mt-4">
            <Link href={`/events/${eventId}/participants`} className="btn-primary">
              Ajouter des participants
            </Link>
          </div>
        </Empty>
      ) : (
        <div className="card p-5">
          <GiftForm
            mode="create"
            action={createGift.bind(null, eventId)}
            people={people}
            couples={couples}
            candidates={candidates}
            cancelHref={pre.length === 1 ? `/events/${eventId}/people/${pre[0]}` : `/events/${eventId}`}
            defaults={{
              name: '',
              url: '',
              price: '',
              status: 'IDEA',
              purchaseMode: 'REMOTE',
              deliveryDate: '',
              note: '',
              recipientIds: pre,
            }}
          />
        </div>
      )}
    </Page>
  );
}
