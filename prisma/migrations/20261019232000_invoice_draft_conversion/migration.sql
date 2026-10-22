ALTER TABLE "InvoiceDraft"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "Invoice"
  ADD COLUMN "sourceDraftId" TEXT;

CREATE UNIQUE INDEX "Invoice_sourceDraftId_key" ON "Invoice"("sourceDraftId");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_sourceDraftId_fkey"
  FOREIGN KEY ("sourceDraftId") REFERENCES "InvoiceDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
