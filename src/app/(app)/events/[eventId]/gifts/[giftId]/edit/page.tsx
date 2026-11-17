import { notFound } from 'next/navigation';
import { loadEvent } from '@/lib/event-data';
import { giftFormData } from '@/lib/gift-form-data';
import { toDateInput } from '@/lib/forms';
import { centsToInput } from '@/lib/domain/money';
import { updateGift } from '@/app/actions/gifts';
import { GiftForm } from '@/components/GiftForm';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Modifier le cadeau' };

export default async function EditGiftPage({ params }: { params: Promise<{ eventId: string; giftId: string }> }) {
  const { eventId, giftId } = await params;
  const view = await loadEvent(eventId);
  const gift = view.data.gifts.find((g) => g.id === giftId);
  if (!gift) notFound();
  const { people, couples, candidates } = await giftFormData(view);

  return (
    <Page
      crumbs={[
        { href: `/events/${eventId}`, label: view.event.name },
        { href: `/events/${eventId}/gifts/${giftId}`, label: gift.name },
        { label: 'Modifier' },
      ]}
      width="max-w-[780px]"
    >
      <PageHeader icon="pencil" title="Modifier le cadeau" subtitle="Les participations et avances se gèrent depuis la fiche du cadeau." />
      <div className="card p-5">
        <GiftForm
          mode="edit"
          action={updateGift.bind(null, eventId, giftId)}
          people={people}
          couples={couples}
          candidates={candidates}
          excludeGiftId={giftId}
          cancelHref={`/events/${eventId}/gifts/${giftId}`}
          defaults={{
            name: gift.name,
            url: gift.url ?? '',
            price: centsToInput(gift.priceCents),
            status: gift.status,
            purchaseMode: gift.purchaseMode,
            deliveryDate: toDateInput(gift.deliveryDate),
            note: gift.note ?? '',
            recipientIds: gift.recipientIds,
          }}
        />
      </div>
    </Page>
  );
}
