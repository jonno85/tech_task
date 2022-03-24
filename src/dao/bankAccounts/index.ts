import { CustomLogger } from "ajv";
import { Knex } from "knex";
import { OutcomeFailure, OutcomeSuccess } from "../../common/outcome/outcome";

export interface BankAccountDBRecord {
  id: number;
  organization_name: string;
  balance_cents: bigint;
  iban: string;
  bic: string;
}

export type BankAccount = {
  id: number;
  organization_name: string;
  balance_cents: bigint;
  iban: string;
  bic: string;
};

export interface GetAllSuccess extends OutcomeSuccess {
  data: {
    bankAccounts: BankAccount[];
  };
}

export interface GetByIdSucces extends OutcomeSuccess {
  data: {
    bankAccount: BankAccount;
  };
}

export type GetAllResult = GetAllSuccess | OutcomeFailure;
export type GetByIdResult = GetByIdSucces | OutcomeFailure;
export type SaveBankAccountResult = SaveBankAccountSuccess | OutcomeFailure;

export interface SaveBankAccountSuccess extends OutcomeSuccess {
  data: {
    bankAccount: BankAccount;
  };
}

export interface BankAccountRepository {
  save(bankAccount: BankAccount): Promise<SaveBankAccountResult>;
  update(bankAccount: BankAccount): Promise<SaveBankAccountResult>;
  getAll(): Promise<GetAllResult>;
  getByIbanAndBic(iban: string, bic: string): Promise<GetByIdResult>;
}

export function buildBankAccountRepository(dependencies: { db: Knex; logger: CustomLogger }): BankAccountRepository {
  const { db, logger } = dependencies;

  return {
    update: async (bankAccount: BankAccount) => {
      const dbTransaction = await db.transaction();
      try {
        await dbTransaction<BankAccountDBRecord>("bank_accounts")
          .update({
            ...bankAccount,
            balance_cents: BigInt(bankAccount.balance_cents),
          })
          .where({ id: bankAccount.id });

        await dbTransaction.commit();

        return {
          outcome: "SUCCESS",
          data: {
            bankAccount,
          },
        };
      } catch (err: any) {
        await dbTransaction.rollback();
        logger.error("Cannot save into db", err);
        return {
          outcome: "FAILURE",
          errorCode: "DATABASE_ERROR",
          reason: "Cannot save into the db",
        };
      }
    },
    save: async (bankAccount: BankAccount) => {
      const dbTransaction = await db.transaction();
      try {
        await dbTransaction<BankAccountDBRecord>("bank_accounts").insert({
          ...bankAccount,
          balance_cents: BigInt(bankAccount.balance_cents),
        });

        await dbTransaction.commit();

        return {
          outcome: "SUCCESS",
          data: {
            bankAccount,
          },
        };
      } catch (err: any) {
        await dbTransaction.rollback();
        logger.error("Cannot save into db", err);
        return {
          outcome: "FAILURE",
          errorCode: "DATABASE_ERROR",
          reason: "Cannot save into the db",
        };
      }
    },
    getAll: async () => {
      try {
        const dbResult = await db.select("*").from<BankAccountDBRecord>("bank_accounts");

        return {
          outcome: "SUCCESS",
          data: {
            bankAccounts: dbResult,
          },
        };
      } catch (err: any) {
        logger.error("Cannot get db values", err);
        return {
          outcome: "FAILURE",
          errorCode: "DATABASE_ERROR",
          reason: "Cannot get values",
        };
      }
    },

    getByIbanAndBic: async (iban: string, bic: string) => {
      try {
        const dbResult = await db
          .select("*")
          .from<BankAccountDBRecord>("bank_accounts")
          .where({ iban: iban, bic: bic });

        if (dbResult.length === 0) {
          return {
            outcome: "FAILURE",
            errorCode: "BANK_ACCOUNT_NOT_FOUND",
            reason: "There is no bank account that matches this iban and bic",
            context: {
              iban,
              bic,
            },
          };
        }

        return {
          outcome: "SUCCESS",
          data: {
            bankAccount: {
              ...dbResult[0],
              balance_cents: BigInt(dbResult[0].balance_cents),
            },
          },
        };
      } catch (err: any) {
        logger.error("Cannot get db values", err);
        return {
          outcome: "FAILURE",
          errorCode: "DATABASE_ERROR",
          reason: "Cannot get values",
        };
      }
    },
  };
}
