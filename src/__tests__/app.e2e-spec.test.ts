import { Server } from "http";
import supertest from "supertest";
import { buildApp } from "../app";
import CustomLogger from "../common/custom-logger";
import { buildBankAccountRepository } from "../dao/bankAccounts";
import { buildTransactionRepository } from "../dao/transaction";
import { createConnectionPool } from "../database/createConnectionPool";
import { truncateTable } from "../database/scripts/bootstrapDB";
import { buildTransactionService } from "../services";
import { expect, jest, describe, it, beforeAll, beforeEach, afterAll } from "@jest/globals";

const db = createConnectionPool();
const logger = CustomLogger;
const bankAccountRepository = buildBankAccountRepository({ db, logger });
const transactionRepository = buildTransactionRepository({ db, logger });

const transactionService = buildTransactionService({ db, logger, transactionRepository, bankAccountRepository });

describe("Test the Qonto Service", () => {
  let server: Server;
  let app: any;

  beforeAll(async () => {
    app = await buildApp({ db, logger, transactionService });

    server = app.listen();

    server.on("close", async () => {
      await db.destroy();
    });
  });
  afterAll(() => {
    server.close();
  });

  beforeEach(async () => {
    await truncateTable();
  });

  const initDbData = async () => {
    // init db

    await bankAccountRepository.save({
      id: 1,
      organization_name: "ACME Corp",
      balance_cents: BigInt(9983126634),
      iban: "FR10474608000002006107XXXXX",
      bic: "OIVUSCLQXXX",
    });
    await bankAccountRepository.save({
      id: 2,
      organization_name: "ACME Corp 2",
      balance_cents: BigInt(10000),
      iban: "DE10474608000002006107XXXXX",
      bic: "OIVUGERQXXX",
    });
  };

  describe("Get health endpoint", () => {
    it("should get the healthcheck", async () => {
      const res = await supertest(app).get("/health");
      expect(res.status).toEqual(200);
      expect(res.body).toStrictEqual({
        service_name: "Qonto service",
        health: "OK",
      });
    });
  });
  describe("Given a list of transactions", () => {
    describe("Given bank account that does not exist", () => {
      it("should return FAILURE and BANK_ACCOUNT_NOT_EXIST", async () => {
        await initDbData();
        const dataBulk1 = {
          organization_name: "ACME Corp",
          organization_bic: "NOT_EXIST",
          organization_iban: "FR10474608000002006107XXXXX",
          credit_transfers: [
            {
              amount: "14.5",
              currency: "EUR",
              counterparty_name: "Bip Bip",
              counterparty_bic: "CRLYFRPPTOU",
              counterparty_iban: "EE383680981021245685",
              description: "Wonderland/4410",
            },
          ],
        };
        const res = await supertest(app).post("/v1/transfer/bulk").send(dataBulk1);

        expect(res.status).toEqual(400);
        expect(res.body).toStrictEqual({
          outcome: "FAILURE",
          errorCode: "BANK_ACCOUNT_NOT_EXIST",
          reason: "no bank account with these coordinates",
        });
      });
      describe("Given bank account exists", () => {
        describe("Given enough money in the bank account", () => {
          it("should return SUCCESS and the bulk transactions ", async () => {
            await initDbData();
            const dataBulk1 = {
              organization_name: "ACME Corp",
              organization_bic: "OIVUSCLQXXX",
              organization_iban: "FR10474608000002006107XXXXX",
              credit_transfers: [
                {
                  amount: "14.5",
                  currency: "EUR",
                  counterparty_name: "Bip Bip",
                  counterparty_bic: "CRLYFRPPTOU",
                  counterparty_iban: "EE383680981021245685",
                  description: "Wonderland/4410",
                },
                {
                  amount: "61238",
                  currency: "EUR",
                  counterparty_name: "Wile E Coyote",
                  counterparty_bic: "ZDRPLBQI",
                  counterparty_iban: "DE9935420810036209081725212",
                  description: "//TeslaMotors/Invoice/12",
                },
                {
                  amount: "999",
                  currency: "EUR",
                  counterparty_name: "Bugs Bunny",
                  counterparty_bic: "RNJZNTMC",
                  counterparty_iban: "FR0010009380540930414023042",
                  description: "2020 09 24/2020 09 25/GoldenCarrot/",
                },
              ],
            };
            const res = await supertest(app).post("/v1/transfer/bulk").send(dataBulk1);
            expect(res.status).toEqual(201);
            expect(res.body.outcome).toEqual("SUCCESS");
            const response = res.body.data.bulkTransaction;
            expect(response).toStrictEqual({
              ...dataBulk1,
            });
          });
        });

        describe("Given NOT enough money in the bank account", () => {
          it("should return FAILURE and the error INSUFFICIENT_FUND", async () => {
            await initDbData();
            const dataBulk1 = {
              organization_name: "ACME Corp 2",
              organization_bic: "OIVUGERQXXX",
              organization_iban: "DE10474608000002006107XXXXX",
              credit_transfers: [
                {
                  amount: "20000000",
                  currency: "EUR",
                  counterparty_name: "Bip Bip",
                  counterparty_bic: "CRLYFRPPTOU",
                  counterparty_iban: "EE383680981021245685",
                  description: "Wonderland/4410",
                },
                {
                  amount: "61238",
                  currency: "EUR",
                  counterparty_name: "Wile E Coyote",
                  counterparty_bic: "ZDRPLBQI",
                  counterparty_iban: "DE9935420810036209081725212",
                  description: "//TeslaMotors/Invoice/12",
                },
                {
                  amount: "999",
                  currency: "EUR",
                  counterparty_name: "Bugs Bunny",
                  counterparty_bic: "RNJZNTMC",
                  counterparty_iban: "FR0010009380540930414023042",
                  description: "2020 09 24/2020 09 25/GoldenCarrot/",
                },
              ],
            };
            const res = await supertest(app).post("/v1/transfer/bulk").send(dataBulk1);

            expect(res.status).toEqual(422);
            const response = res.body;
            expect(response).toStrictEqual({
              outcome: "FAILURE",
              errorCode: "INSUFFICIENT_FUND",
              reason: "not enough fund to emi bulk transaction",
            });
          });
        });
      });
    });
  });
});
