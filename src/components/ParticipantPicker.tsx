'use client';

import { useMemo, useState } from 'react';
import { avatarColor } from '@/lib/ui';

type Person = { id: string; name: string; initials: string; color: string; inEvent: boolean; couple: string | null; age: number | null };
type Group = { key: string; name: string; people: Person[] };

/** Sélection de personnes du carnet, avec ajout groupé par famille. */
export function ParticipantPicker({ groups }: { groups: Group[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, people: g.people.filter((p) => p.name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) }))
      .filter((g) => g.people.length > 0);
  }, [groups, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (g: Group, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of g.people) if (!p.inEvent) (on ? next.add(p.id) : next.delete(p.id));
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="personIds" value={id} />
      ))}
      <div>
        <label htmlFor="pp-search" className="sr-only">
          Rechercher dans le carnet
        </label>
        <input id="pp-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher dans le carnet" className="input" />
      </div>
      <div className="flex max-h-[460px] flex-col gap-3 overflow-y-auto pr-1">
        {visible.map((g) => {
          const addable = g.people.filter((p) => !p.inEvent);
          const allOn = addable.length > 0 && addable.every((p) => selected.has(p.id));
          const someOn = addable.some((p) => selected.has(p.id));
          const present = g.people.length - addable.length;
          return (
            <div key={g.key}>
              <label className="flex items-center gap-2.5 rounded-md bg-soft px-2 py-1.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-pine"
                  checked={allOn}
                  disabled={addable.length === 0}
                  ref={(el) => {
                    if (el) el.indeterminate = someOn && !allOn;
                  }}
                  onChange={(e) => toggleGroup(g, e.target.checked)}
                />
                <span className="text-[13px] font-semibold">{g.name}</span>
                <span className="text-xs text-muted">
                  {addable.length === 0
                    ? 'tous déjà ajoutés'
                    : present > 0
                      ? `${present}/${g.people.length} déjà ajoutés`
                      : `ajout groupé · ${g.people.length} pers.`}
                </span>
              </label>
              <ul>
                {g.people.map((p) => {
                  const c = avatarColor(p.color);
                  return (
                    <li key={p.id}>
                      <label className={`flex items-center gap-2.5 rounded-md py-1.5 pl-8 pr-2 ${p.inEvent ? 'text-muted' : 'cursor-pointer hover:bg-soft'}`}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-pine"
                          checked={p.inEvent || selected.has(p.id)}
                          disabled={p.inEvent}
                          onChange={() => toggle(p.id)}
                        />
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{ background: c.bg, color: c.fg }}
                          aria-hidden="true"
                        >
                          {p.initials}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {p.name}
                          {p.age != null ? <span className="text-xs text-muted"> · {p.age} ans</span> : null}
                          {p.couple ? <span className="text-xs text-couple"> · avec {p.couple}</span> : null}
                        </span>
                        {p.inEvent ? <span className="text-xs">Déjà ajouté</span> : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="text-[13px] text-muted" aria-live="polite">
        {selected.size === 0 ? 'Aucune personne sélectionnée' : `${selected.size} personne${selected.size > 1 ? 's' : ''} sélectionnée${selected.size > 1 ? 's' : ''}`}
      </div>
    </div>
  );
}
