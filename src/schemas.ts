import * as z from "zod";
import { SchemaError } from "./errors.js";

export function parseWith<T>(schema: z.ZodType<T>, data: unknown, what: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new SchemaError(`Unexpected ${what} payload from Benepass`);
  }
  return parsed.data;
}

export function parseItems<T>(itemSchema: z.ZodType<T>, payload: unknown, what: string): T[] {
  const ItemsSchema = z.union([
    z.array(itemSchema),
    z.looseObject({
      data: z.array(itemSchema).optional(),
      results: z.array(itemSchema).optional(),
    }),
  ]);
  const value = parseWith(ItemsSchema, payload, what);
  if (Array.isArray(value)) {
    return value;
  }
  return value.data ?? value.results ?? [];
}

export const BalanceSchema = z.looseObject({
  key: z.string(),
  amount: z.unknown().optional(),
  formatted_local_amount: z.unknown().optional(),
});

export const BenefitSchema = z.looseObject({
  id: z.string(),
  name: z.string().optional(),
  benefit_type: z.string().optional(),
  key: z.string().optional(),
});

export const EnrollmentSchema = z.looseObject({
  benefit: BenefitSchema.optional(),
  local_max_expense_amount: z.unknown().optional(),
  max_expense_amount: z.unknown().optional(),
});

export const AccountSchema = z.looseObject({
  id: z.string(),
  key: z.string().optional(),
  type: z.string().optional(),
  account_type: z.string().optional(),
  name: z.string().optional(),
  balances: z.array(BalanceSchema).optional(),
  enrollment: EnrollmentSchema.optional(),
});

export type Account = z.infer<typeof AccountSchema>;
export type Balance = z.infer<typeof BalanceSchema>;

export const WorkspaceSchema = z.looseObject({
  id: z.string(),
  type: z.string().optional(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

export const DerivedBenefitSchema = z.object({
  id: z.string(),
  name: z.unknown(),
  benefit_type: z.unknown(),
  account_id: z.string(),
  available_balance: z.unknown(),
  formatted_available_balance: z.unknown(),
  max_per_expense: z.unknown(),
});

export type DerivedBenefit = z.infer<typeof DerivedBenefitSchema>;

export const HsaAccountDetailsSchema = z.looseObject({
  id: z.string().optional(),
  account_id: z.string().optional(),
  account: z.looseObject({ id: z.string().optional() }).optional(),
});

export const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
});

export const JwtPayloadSchema = z.object({
  exp: z.number().optional(),
});

export const StartLoginOutputSchema = z.object({
  challenge_name: z.string(),
  challenge_session: z.string(),
});

export const CompleteLoginOutputSchema = z.object({
  ok: z.literal(true),
  email: z.string(),
});

export const AuthStatusOutputSchema = z.union([
  z.object({ logged_in: z.literal(false) }),
  z.object({ logged_in: z.literal(true), email: z.string() }),
]);

export const LogoutOutputSchema = z.object({
  ok: z.literal(true),
});

export const ListPayloadSchema = z.object({
  data: z.array(z.unknown()),
});

export const HsaInvestmentsOutputSchema = z.object({
  account_id: z.string(),
  path: z.string(),
  body: z.unknown(),
});

export const JsonObjectSchema = z.looseObject({});

export const workspaceIdField = z
  .string()
  .min(1)
  .optional()
  .describe("Workspace id; defaults to the first employment workspace");

export const workspaceInputSchema = z.object({
  workspace_id: workspaceIdField,
});
