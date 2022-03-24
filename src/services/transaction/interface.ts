import { OutcomeFailure, OutcomeSuccess } from "../../common/outcome/outcome";

export interface CreditTransfer {
  amount: string;
  currency: "EUR";
  counterparty_name: string;
  counterparty_bic: string;
  counterparty_iban: string;
  description: string;
}

export interface BulkTransaction {
  organization_name: string;
  organization_bic: string;
  organization_iban: string;
  credit_transfers: CreditTransfer[];
}

export interface BulkTransactionSuccess extends OutcomeSuccess {
  data: {
    bulkTransaction: BulkTransaction;
  };
}

export interface TransactionService {
  bulkTransactions(bulkTransaction: BulkTransaction): Promise<BulkTransactionSuccess | OutcomeFailure>;
}
