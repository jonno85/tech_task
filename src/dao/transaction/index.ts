import { CustomLogger } from "ajv";
import { Knex } from "knex";
import { OutcomeFailure, OutcomeSuccess } from "../../common/outcome/outcome";

export interface TransactionDBRecord {
  counterparty_name: string;
  counterparty_iban: string;
  counterparty_bic: string;
  amount_cents: BigInt;
  amount_currency: string;
  bank_account_id: number;
  description: string;
}

export type Transaction = {
  counterparty_name: string;
  counterparty_iban: string;
  counterparty_bic: string;
  amount_cents: BigInt;
  amount_currency: string;
  bank_account_id: number;
  description: string;
};
export interface GetAllSuccess extends OutcomeSuccess {
  data: {
    transactions: Transaction[];
  };
}

export interface GetByIdSucces extends OutcomeSuccess {
  data: {
    transaction: Transaction;
  };
}

export type GetAllResult = GetAllSuccess | OutcomeFailure;
export type GetByIdResult = GetByIdSucces | OutcomeFailure;
export type SaveTransactionResult = SaveTransactionSuccess | OutcomeFailure;

export interface SaveTransactionSuccess extends OutcomeSuccess {
  data: {
    transactions: Transaction[];
  };
}

export interface TransactionRepository {
  saveAll(transactions: Transaction[]): Promise<SaveTransactionResult>;
  getAll(): Promise<GetAllResult>;
  getByName(name: string): Promise<GetByIdResult>;
}

export function buildTransactionRepository(dependencies: { db: Knex; logger: CustomLogger }): TransactionRepository {
  const { db, logger } = dependencies;

  return {
    saveAll: async (transactions: Transaction[]) => {
      const dbTransaction = await db.transaction();
      try {
        await dbTransaction<TransactionDBRecord>("transactions").insert([...transactions]);
        // await dbTransaction<TransactionDBRecord>("transactions").insert([
        //   {
        //     ...transactions[0],
        //     amount_cents: transactions[0].amount_cents,
        //   },
        // ]);

        await dbTransaction.commit();

        return {
          outcome: "SUCCESS",
          data: {
            transactions,
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
        const dbResult = await db.select("*").from<TransactionDBRecord>("transactions");

        return {
          outcome: "SUCCESS",
          data: {
            transactions: dbResult,
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

    getByName: async (name: string) => {
      try {
        const dbResult = await db
          .select("*")
          .from<TransactionDBRecord>("transactions")
          .where({ counterparty_name: name });

        if (dbResult.length === 0) {
          return {
            outcome: "FAILURE",
            errorCode: "TRANSACTION_NOT_FOUND",
            reason: "There is no transaction that matches this name",
            context: {
              name,
            },
          };
        }
        return {
          outcome: "SUCCESS",
          data: {
            transaction: dbResult[0],
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
