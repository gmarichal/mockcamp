-- AlterTable
ALTER TABLE "RequestLog" ADD COLUMN IF NOT EXISTS "responseHeaders" JSONB;
