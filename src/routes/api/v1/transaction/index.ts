import express from "express";
import { TransactionService } from "../../../../services";

import { buildTransactionHandler } from "./transaction.post";

export default function buildTransactionRouter(dependencies: { transactionService: TransactionService }) {
  const { transactionService } = dependencies;
  const transactionRouter = express.Router();

  const transactionHandler = buildTransactionHandler({ transactionService });

  transactionRouter.post("/transfer/bulk", transactionHandler);

  return transactionRouter;
}
