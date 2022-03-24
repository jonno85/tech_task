import { CustomLogger } from "ajv";
import { Knex } from "knex";
import { BulkTransaction, BulkTransactionSuccess, TransactionService } from "./interface";
import { OutcomeFailure } from "../../common/outcome/outcome";
import { Transaction, TransactionRepository } from "../../dao/transaction";
import { BankAccountRepository } from "../../dao/bankAccounts";

export interface TransactionServiceConfiguration {
  db: Knex;
  logger: CustomLogger;
  bankAccountRepository: BankAccountRepository;
  transactionRepository: TransactionRepository;
}

export function buildTransactionService(dependencies: TransactionServiceConfiguration): TransactionService {
  const { bankAccountRepository, logger, transactionRepository } = dependencies;

  const bulkTransactions = async (
    bulkTransaction: BulkTransaction
  ): Promise<BulkTransactionSuccess | OutcomeFailure> => {
    const { organization_bic, organization_iban, credit_transfers } = bulkTransaction;

    const totalTransferAmount = credit_transfers.reduce(
      (element1, element2) => element1 + parseFloat(element2.amount),
      0
    );

    const getByIbanAndBicResult = await bankAccountRepository.getByIbanAndBic(organization_iban, organization_bic);
    if (getByIbanAndBicResult.outcome === "FAILURE") {
      return {
        outcome: "FAILURE",
        errorCode: "BANK_ACCOUNT_NOT_EXIST",
        reason: "no bank account with these coordinates",
      };
    }
    const { bankAccount } = getByIbanAndBicResult.data;

    if (bankAccount.balance_cents < totalTransferAmount) {
      return {
        outcome: "FAILURE",
        errorCode: "INSUFFICIENT_FUND",
        reason: "not enough fund to emi bulk transaction",
      };
    }

    // Preemptive hold of funds, to avoid other transaction might take money concurrently
    const originalBalanceCents = bankAccount.balance_cents;
    const totalTransferAmountCents = BigInt(totalTransferAmount * 100);
    bankAccount.balance_cents -= totalTransferAmountCents;

    const preemptiveUpdateBankAccountResult = await bankAccountRepository.update(bankAccount);
    if (preemptiveUpdateBankAccountResult.outcome === "FAILURE") {
      return {
        outcome: "FAILURE",
        errorCode: "ERROR_HOLD_FUNDS_BANK_ACCOUNT",
        reason: "Impossible to hold funds for bank account",
      };
    }
    const transactions: Transaction[] = credit_transfers.map((transfer) => ({
      amount_cents: BigInt(parseFloat(transfer.amount) * 100),
      amount_currency: transfer.currency,
      bank_account_id: bankAccount.id,
      counterparty_bic: transfer.counterparty_bic,
      counterparty_iban: transfer.counterparty_iban,
      counterparty_name: transfer.counterparty_name,
      description: transfer.description,
    }));

    const saveAllResult = await transactionRepository.saveAll(transactions);
    if (saveAllResult.outcome === "FAILURE") {
      // the funds must be released
      bankAccount.balance_cents = originalBalanceCents;
      const restorePreemptiveUpdateBankAccountResult = await bankAccountRepository.update(bankAccount);

      if (restorePreemptiveUpdateBankAccountResult.outcome === "FAILURE") {
        logger.error("Impossible to restore hold funds after failing transactions > Manual intervention", {
          bankAccount: {
            bic: bankAccount.bic,
            iban: bankAccount.iban,
          },
          originalAmount: originalBalanceCents,
          totalTransferAmountCents: totalTransferAmountCents,
        });
        return {
          outcome: "FAILURE",
          errorCode: "ERROR_RECOVER_HOLD_FUNDS_BANK_ACCOUNT",
          reason: "Impossible to recover hold funds to bank account",
        };
      }
      return {
        outcome: "FAILURE",
        errorCode: saveAllResult.errorCode,
        reason: saveAllResult.reason,
      };
    }

    return {
      outcome: "SUCCESS",
      data: {
        bulkTransaction,
      },
    };
  };

  return { bulkTransactions };
}
