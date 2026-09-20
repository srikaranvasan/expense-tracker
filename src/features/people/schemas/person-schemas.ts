import { z } from "zod";
import { LIMITS } from "@/config/constants";
import { clientIdString, entityName, objectIdString, searchTerm } from "@/lib/validation/helpers";

export const createPersonSchema = z.object({
  clientId: clientIdString,
  name: entityName,
  notes: z.string().trim().max(LIMITS.notesMaxLength).nullish(),
});

export type CreatePersonRequest = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = z
  .object({
    name: entityName.optional(),
    notes: z.string().trim().max(LIMITS.notesMaxLength).nullish(),
    expectedSyncVersion: z.coerce.number().int().min(1).optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.notes !== undefined,
    "Provide at least one field to update.",
  );

export type UpdatePersonRequest = z.infer<typeof updatePersonSchema>;

export const listPeopleQuerySchema = z.object({
  search: searchTerm,
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const personIdParamSchema = z.object({ id: objectIdString });
