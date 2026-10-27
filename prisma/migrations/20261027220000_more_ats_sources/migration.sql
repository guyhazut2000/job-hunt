-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AtsProvider" ADD VALUE 'ASHBY';
ALTER TYPE "AtsProvider" ADD VALUE 'WORKABLE';
ALTER TYPE "AtsProvider" ADD VALUE 'SMARTRECRUITERS';
ALTER TYPE "AtsProvider" ADD VALUE 'WORKDAY';
ALTER TYPE "AtsProvider" ADD VALUE 'RECRUITEE';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "department" TEXT,
ADD COLUMN     "payCurrency" TEXT,
ADD COLUMN     "payMax" INTEGER,
ADD COLUMN     "payMin" INTEGER,
ADD COLUMN     "payPeriod" TEXT;

