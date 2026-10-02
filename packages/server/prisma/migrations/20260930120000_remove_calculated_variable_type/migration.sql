-- Remove the CALCULATED variable type: it evaluated user-supplied expressions via
-- `new Function`, which had access to the Node global scope (including process.env),
-- letting any project member with variable-write access read server secrets
-- (DATABASE_URL, JWT_SECRET) through a mocked response body.

-- Convert any existing CALCULATED variables to STATIC with an empty value so no
-- row is left pointing at a value the new enum no longer has.
UPDATE "Variable" SET "type" = 'STATIC', "value" = '', "expression" = NULL WHERE "type" = 'CALCULATED';

-- Recreate the enum without CALCULATED (Postgres has no direct DROP VALUE).
ALTER TYPE "VariableType" RENAME TO "VariableType_old";
CREATE TYPE "VariableType" AS ENUM ('STATIC', 'DYNAMIC');
ALTER TABLE "Variable" ALTER COLUMN "type" TYPE "VariableType" USING ("type"::text::"VariableType");
DROP TYPE "VariableType_old";
