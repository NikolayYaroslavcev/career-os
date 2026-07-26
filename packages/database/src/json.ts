import { Prisma } from '@prisma/client';

/** Casts an already-serializable value for a required Prisma `Json` column. */
export function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** Casts a possibly-null value for a nullable Prisma `Json?` column. */
export function toNullableJsonInput(
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

/** Reads back a nullable Prisma `Json?` column, collapsing the write-only `Prisma.JsonNull` sentinel to `null`. */
export function fromNullableJsonInput<T>(value: unknown): T | null {
  return value === null || value === undefined || value === Prisma.JsonNull ? null : (value as T);
}
