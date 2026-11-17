import { loadEvent } from '@/lib/event-data';
import { Page } from '@/components/Page';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';

export const metadata = { title: 'Export Excel' };

function Check({ name, label, defaultChecked = false }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <input type="checkbox" name={name} value="1" defaultChecked={defaultChecked} className="h-4 w-4 accent-pine" />
      {label}
    </label>
  );
}

function Radio({ name, value, label, hint, defaultChecked = false }: { name: string; value: string; label: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-3 text-[13px] has-[:checked]:border-pine has-[:checked]:bg-pine-light">
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-pine" />
      <span>
        <span className="font-semibold">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export default async function ExportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, data } = await loadEvent(eventId);
  return (
    <Page crumbs={[{ href: `/events/${eventId}`, label: event.name }, { label: 'Export Excel' }]} width="max-w-[860px]">
      <PageHeader
        icon="table"
        title="Export Excel"
        subtitle={`Toutes les données chiffrées de ${event.name} : une colonne par personne, une ligne par cadeau.`}
      />
      <form method="get" action={`/api/events/${eventId}/export`} className="flex flex-col gap-7">
        <input type="hidden" name="submitted" value="1" />

        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Regrouper les lignes par</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <Radio name="group" value="person" label="Personne" hint="Chaque destinataire, avec son sous-total." />
            <Radio name="group" value="couple" label="Couple" hint="Les deux membres du couple ensemble." />
            <Radio name="group" value="family" label="Famille" hint="Famille, puis personne, avec sous-totaux." defaultChecked />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Participations en couple</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Radio name="coupleMode" value="split" label="Réparties dans les colonnes de chaque personne" hint="Selon la répartition du couple (50 / 50 par défaut)." defaultChecked />
            <Radio name="coupleMode" value="column" label="Une colonne par couple" hint="Les participations seules restent dans les colonnes des personnes." />
          </div>
        </fieldset>

        <div className="grid gap-7 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-2">Onglets du classeur</legend>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" checked disabled className="h-4 w-4 accent-pine" />
              Cadeaux × participants
            </label>
            <Check name="perPerson" label="Synthèse par personne (reçu, dépensé, plafonds)" defaultChecked />
            <Check name="groups" label="Synthèse par couple et famille" defaultChecked />
            <Check name="balances" label="Balances : avances et remboursements" defaultChecked />
            <Check name="flows" label="Qui offre à qui (matrice par famille)" />
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-2">Colonnes en plus</legend>
            <Check name="colStatus" label="Statut et avancement" defaultChecked />
            <Check name="colAdvance" label="Avance (qui a payé, combien)" defaultChecked />
            <Check name="colLink" label="Lien et date de livraison" />
          </fieldset>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line2 pt-4">
          <span className="text-[13px] text-muted">
            {data.gifts.length} cadeaux · {data.participants.length} personnes
          </span>
          <button type="submit" className="btn-primary ml-auto">
            <Icon name="download" size={15} />
            Télécharger le fichier .xlsx
          </button>
        </div>
      </form>
    </Page>
  );
}
