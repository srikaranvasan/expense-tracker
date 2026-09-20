/** Types shared across layers that do not belong to a single feature. */

export type Nullable<T> = T | null;

export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Stringified ObjectId. Ids only ever cross layer boundaries as strings. */
export type Id = string;

export type AccountType = "bank" | "cash" | "credit_card";

export type TransactionType = "expense" | "income" | "transfer" | "credit_card_payment";

export type ParticipantType = "user" | "person";

export type SplitMethod = "equal" | "custom" | "percentage";

export type SettlementDirection = "user_to_person" | "person_to_user";

export type SplitStatus = "unsettled" | "partially_settled" | "settled";

export type PersonBalanceDirection = "person_owes_user" | "user_owes_person" | "settled";

/** Money as it travels over the wire and through view models. */
export type MoneyDto = {
  amount: string;
  currency: string;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type SoftDeletable = {
  deletedAt?: Date | null;
};

export type Timestamped = {
  createdAt: Date;
  updatedAt: Date;
};

/** Sync metadata carried by every entity that participates in offline sync. */
export type SyncTracked = {
  clientId: string;
  syncVersion: number;
};
