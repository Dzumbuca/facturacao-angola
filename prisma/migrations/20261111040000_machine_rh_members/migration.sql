-- Machine RH — funções por empresa (aditivo; não aplicar em produção sem aprovação).

CREATE TYPE "RhMemberRole" AS ENUM ('ADMIN', 'MANAGER', 'FINANCE');

CREATE TABLE "RhMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RhMemberRole" NOT NULL DEFAULT 'MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RhMember_tenantId_userId_key" ON "RhMember"("tenantId", "userId");
CREATE INDEX "RhMember_tenantId_role_idx" ON "RhMember"("tenantId", "role");

ALTER TABLE "RhMember" ADD CONSTRAINT "RhMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhMember" ADD CONSTRAINT "RhMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhMember" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_member_isolation" ON "RhMember" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
