import Link from 'next/link';
import { loadCarnet } from '@/lib/event-data';
import { createPerson } from '@/app/actions/carnet';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { Page } from '@/components/Page';
import { PersonFields } from '@/components/PersonFields';
import { Avatar, Empty, PageHeader, Section } from '@/components/ui';
import { Icon } from '@/components/icons';

export const metadata = { title: 'Personnes' };

export default async function PeoplePage() {
  const { persons, families, directory: dir } = await loadCarnet();
  const groups = [
    ...families.map((f) => ({ key: f.id, name: f.name, people: persons.filter((p) => p.familyId === f.id) })),
    { key: 'none', name: 'Sans famille', people: persons.filter((p) => !p.familyId) },
  ].filter((g) => g.people.length > 0);

  return (
    <Page crumbs={[{ label: 'Carnet' }, { label: 'Personnes' }]}>
      <PageHeader
        icon="users"
        title="Personnes"
        subtitle="Le carnet est commun à tous vos événements. Les budgets se règlent ensuite dans chaque événement."
        actions={
          <Link href="/families" className="btn">
            <Icon name="rings" size={15} />
            Familles &amp; couples
          </Link>
        }
      />

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-7">
          {groups.length === 0 ? (
            <Empty icon="users" title="Le carnet est vide">
              Ajoutez une première personne avec le formulaire.
            </Empty>
          ) : (
            groups.map((g) => (
              <Section key={g.key} title={g.name} count={g.people.length}>
                <ul className="overflow-hidden rounded-[10px] border border-line">
                  {g.people.map((p, i) => {
                    const partner = dir.partnerOf(p.id);
                    const age = dir.age(p.id);
                    return (
                      <li key={p.id} className={i ? 'border-t border-line2' : ''}>
                        <Link href={`/people/${p.id}`} className="row-link flex items-center gap-3 px-3.5 py-2.5">
                          <Avatar initials={dir.initials(p.id)} color={p.color} size={32} />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{dir.personName(p.id)}</div>
                            <div className="flex flex-wrap gap-x-2 text-xs text-muted">
                              {age != null ? <span>{age} ans</span> : null}
                              {partner ? (
                                <span className="inline-flex items-center gap-1 text-couple">
                                  <Icon name="rings" size={12} strokeWidth={2} />
                                  en couple avec {partner.firstName}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <Icon name="chevronRight" size={16} className="text-faint" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            ))
          )}
        </div>

        <aside className="card p-4 lg:sticky lg:top-6">
          <h2 className="mb-3 font-semibold">Nouvelle personne</h2>
          <ActionForm action={createPerson} resetOnSuccess className="flex flex-col gap-4">
            <PersonFields families={families} idPrefix="new" />
            <SubmitButton pendingLabel="Ajout…">Ajouter au carnet</SubmitButton>
          </ActionForm>
        </aside>
      </div>
    </Page>
  );
}
