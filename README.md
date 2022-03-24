# Description

Qonto technical Task

The system serves the endpoint `/v1/transfer/bulk` which takes the bulk transaction input and returns the transactions written into the system

# Transaction service

It is the service that performs the checks and write to db tables `bank-accounts` and `transactions`.

# Implementation

I used the framework `expressjs`, the IoC pattern to let the dependencies injection, Outcome Pattern, Repository pattern and wrote the tests.

The path, except the healtcheck, is behind the `v1` subpath for api versioning.
To connect to db (postgres), I use knex.
I validate the inputs with schema using the Zod library.

Considering that there could be more than one instance running, to prevent concurrent bulk transfert on the same account, I preemptive hold the fund from the sourced bank account before writing the transactions (tipical 2 phase commit problem). In case the last succeed, bank account table entry is already updated. In case transactions are failing the original held fund must be restored to the bank account, which is done in the failing condition `restorePreemptiveUpdateBankAccountResult`. There is still the chance that this backing strategy fails for which I decided to simply write the error statement. (alternative: saga, cross table transactions )

# To prepare the environment

1. docker-compose up -d (will start postgres db locally)
2. npm install (install the dependency)
3. npm run migrate:up (run the migration db files)

# Tests (e2e)

4. npm run test

# To run the application

5. npm run dev
