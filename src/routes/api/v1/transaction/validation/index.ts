import { z } from "zod";

export const bulkTransactionValidationSchema = z.object({
  organization_name: z.string().min(2),
  organization_bic: z.string().min(2),
  organization_iban: z.string().min(11),
  credit_transfers: z
    .object({
      amount: z.string().min(1),
      currency: z.literal("EUR"),
      counterparty_name: z.string().min(2),
      counterparty_bic: z.string().min(4),
      counterparty_iban: z.string().min(11),
      description: z.string().min(4),
    })
    .array(),
});
