// Types du domaine, indépendants de la base de données.
// Tous les montants sont en centimes d'euro.

export type GiftStatus = 'IDEA' | 'FOUND' | 'BOUGHT' | 'RECEIVED' | 'WRAPPED';
export type PurchaseMode = 'ON_SITE' | 'REMOTE';

export interface DPerson {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  color: string;
  familyId: string | null;
}

export interface DFamily {
  id: string;
  name: string;
}

export interface DCouple {
  id: string;
  personAId: string;
  personBId: string;
  /** Part de la personne A (0–100) dans les dépenses communes. */
  splitA: number;
  sharedAccount: boolean;
}

export interface DParticipant {
  personId: string;
  receiveMaxCents: number | null;
  spendMaxCents: number | null;
}

/** Une personne OU un couple. */
export interface Party {
  personId: string | null;
  coupleId: string | null;
}

export interface DContribution extends Party {
  id: string;
  amountCents: number;
}

export interface DAdvance {
  id: string;
  payerId: string;
  amountCents: number;
  paidAt: Date;
  note: string | null;
}

export interface DGift {
  id: string;
  name: string;
  url: string | null;
  priceCents: number;
  status: GiftStatus;
  purchaseMode: PurchaseMode;
  deliveryDate: Date | null;
  note: string | null;
  createdAt: Date;
  recipientIds: string[];
  contributions: DContribution[];
  advances: DAdvance[];
}

export interface DRepayment {
  id: string;
  from: Party;
  to: Party;
  amountCents: number;
  paidAt: Date;
  note: string | null;
}

export interface EventData {
  persons: DPerson[];
  families: DFamily[];
  couples: DCouple[];
  participants: DParticipant[];
  gifts: DGift[];
  repayments: DRepayment[];
}
