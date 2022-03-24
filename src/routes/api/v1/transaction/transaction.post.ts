import Boom from "@hapi/boom";
import { NextFunction, Request, Response } from "express";

import CustomLogger from "../../../../common/custom-logger";
import { TransactionService } from "../../../../services";
import { bulkTransactionValidationSchema } from "./validation";

export function buildTransactionHandler(dependencies: { transactionService: TransactionService }) {
  const { transactionService } = dependencies;
  return async function bulkTransactionHandler(req: Request, res: Response, next: NextFunction) {
    try {
      const validationResult = bulkTransactionValidationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).send(validationResult.error);
      }

      const result = await transactionService.bulkTransactions(validationResult.data);

      if (result.outcome === "FAILURE") {
        return res.status(result.errorCode === "INSUFFICIENT_FUND" ? 422 : 400).send(result);
      }

      return res.status(201).send(result);
    } catch (e: any) {
      CustomLogger.error(e);

      return next(Boom.badRequest(e));
    }
  };
}
