import type { DCouple, DFamily, DPerson, Party } from './types';
import { splitCents } from './money';

/** Annuaire : retrouve personnes, couples et familles et construit les libellés. */
export class Directory {
  private personsById = new Map<string, DPerson>();
  private couplesById = new Map<string, DCouple>();
  private coupleByPerson = new Map<string, DCouple>();
  private familiesById = new Map<string, DFamily>();

  constructor(data: { persons: DPerson[]; couples: DCouple[]; families: DFamily[] }) {
    for (const p of data.persons) this.personsById.set(p.id, p);
    for (const c of data.couples) {
      this.couplesById.set(c.id, c);
      this.coupleByPerson.set(c.personAId, c);
      this.coupleByPerson.set(c.personBId, c);
    }
    for (const f of data.families) this.familiesById.set(f.id, f);
  }

  person(id: string | null | undefined): DPerson | undefined {
    return id ? this.personsById.get(id) : undefined;
  }

  couple(id: string | null | undefined): DCouple | undefined {
    return id ? this.couplesById.get(id) : undefined;
  }

  family(id: string | null | undefined): DFamily | undefined {
    return id ? this.familiesById.get(id) : undefined;
  }

  coupleOf(personId: string): DCouple | undefined {
    return this.coupleByPerson.get(personId);
  }

  partnerOf(personId: string): DPerson | undefined {
    const c = this.coupleOf(personId);
    if (!c) return undefined;
    return this.person(c.personAId === personId ? c.personBId : c.personAId);
  }

  personName(id: string): string {
    const p = this.person(id);
    if (!p) return 'Personne supprimée';
    return [p.firstName, p.lastName].filter(Boolean).join(' ');
  }

  firstName(id: string): string {
    return this.person(id)?.firstName ?? '?';
  }

  initials(id: string): string {
    const p = this.person(id);
    if (!p) return '?';
    return ((p.firstName[0] ?? '') + (p.lastName[0] ?? '')).toUpperCase() || '?';
  }

  /** « Paul & Claire » */
  coupleShortName(id: string): string {
    const c = this.couple(id);
    if (!c) return 'Couple supprimé';
    return `${this.firstName(c.personAId)} & ${this.firstName(c.personBId)}`;
  }

  /** « Paul & Claire Martin » ou « Paul Martin & Claire Durand » */
  coupleFullName(id: string): string {
    const c = this.couple(id);
    if (!c) return 'Couple supprimé';
    const a = this.person(c.personAId);
    const b = this.person(c.personBId);
    if (a && b && a.lastName && a.lastName === b.lastName) {
      return `${a.firstName} & ${b.firstName} ${a.lastName}`;
    }
    return `${this.personName(c.personAId)} & ${this.personName(c.personBId)}`;
  }

  partyName(party: Party, short = false): string {
    if (party.coupleId) return short ? this.coupleShortName(party.coupleId) : this.coupleFullName(party.coupleId);
    if (party.personId) return short ? this.firstName(party.personId) : this.personName(party.personId);
    return '?';
  }

  /** Personnes derrière une partie, avec leur part en centimes d'un montant. */
  partyPersonShares(party: Party, amountCents: number): { personId: string; cents: number }[] {
    if (party.coupleId) {
      const c = this.couple(party.coupleId);
      if (!c) return [];
      const [a, b] = splitCents(amountCents, [c.splitA, 100 - c.splitA]);
      return [
        { personId: c.personAId, cents: a },
        { personId: c.personBId, cents: b },
      ];
    }
    if (party.personId) return [{ personId: party.personId, cents: amountCents }];
    return [];
  }

  /** Âge approximatif à partir de l'année de naissance. */
  age(id: string, now = new Date()): number | null {
    const p = this.person(id);
    if (!p || !p.birthYear) return null;
    return now.getFullYear() - p.birthYear;
  }
}
