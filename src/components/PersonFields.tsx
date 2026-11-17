import { AVATAR_COLORS } from '@/lib/ui';
import { Field } from './ui';

/** Champs d'une personne (création et modification). */
export function PersonFields({
  families,
  defaults,
  idPrefix = 'pf',
}: {
  families: { id: string; name: string }[];
  defaults?: { firstName?: string; lastName?: string; birthYear?: number | null; color?: string; familyId?: string | null; note?: string | null };
  idPrefix?: string;
}) {
  const d = defaults ?? {};
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Prénom" htmlFor={`${idPrefix}-first`}>
        <input id={`${idPrefix}-first`} name="firstName" required defaultValue={d.firstName ?? ''} className="input" autoComplete="off" />
      </Field>
      <Field label="Nom" htmlFor={`${idPrefix}-last`}>
        <input id={`${idPrefix}-last`} name="lastName" defaultValue={d.lastName ?? ''} className="input" autoComplete="off" />
      </Field>
      <Field label="Année de naissance (optionnelle)" htmlFor={`${idPrefix}-year`} hint="Affiche l’âge et trie les membres d’une famille.">
        <input
          id={`${idPrefix}-year`}
          name="birthYear"
          type="number"
          inputMode="numeric"
          min={1900}
          max={new Date().getFullYear()}
          defaultValue={d.birthYear ?? ''}
          className="input"
        />
      </Field>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="label mb-1.5">Couleur</legend>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(AVATAR_COLORS).map(([key, c]) => (
            <label key={key} className="cursor-pointer" title={c.label}>
              <input type="radio" name="color" value={key} defaultChecked={(d.color ?? 'gray') === key} className="peer sr-only" />
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ring-offset-2 peer-checked:ring-2 peer-checked:ring-pine peer-focus-visible:ring-2 peer-focus-visible:ring-pine"
                style={{ background: c.bg, color: c.fg }}
              >
                Aa
                <span className="sr-only">{c.label}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Famille" htmlFor={`${idPrefix}-family`}>
        <select id={`${idPrefix}-family`} name="familyId" defaultValue={d.familyId ?? ''} className="input">
          <option value="">Sans famille</option>
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="… ou nouvelle famille" htmlFor={`${idPrefix}-newfam`} hint="Laissez vide pour garder la famille choisie.">
        <input id={`${idPrefix}-newfam`} name="newFamilyName" placeholder="Famille Petit" className="input" autoComplete="off" />
      </Field>
      <Field label="Note (optionnelle)" htmlFor={`${idPrefix}-note`} className="sm:col-span-2">
        <input id={`${idPrefix}-note`} name="note" defaultValue={d.note ?? ''} className="input" placeholder="Tailles, goûts, idées…" />
      </Field>
    </div>
  );
}
