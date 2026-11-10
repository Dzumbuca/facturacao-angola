-- Machine RH — núcleo. Migração aditiva (não aplicar em produção sem aprovação).

CREATE TYPE "RhEmployeeStatus" AS ENUM ('ACTIVO', 'SUSPENSO', 'FERIAS', 'CESSAO', 'INACTIVO');
CREATE TYPE "RhContractType" AS ENUM ('INDEFINIDO', 'TERMO_CERTO', 'ESTAGIO', 'PRESTACAO_SERVICOS');
CREATE TYPE "RhContractStatus" AS ENUM ('RASCUNHO', 'ACTIVO', 'RENOVADO', 'CESSAO', 'EXPIRADO');

CREATE TABLE "RhDepartment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parentId" TEXT,
    "managerName" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhPosition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "departmentId" TEXT,
    "level" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhEmployee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "bi" TEXT,
    "nif" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "photoUrl" TEXT,
    "departmentId" TEXT,
    "positionId" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "contractType" "RhContractType" NOT NULL DEFAULT 'INDEFINIDO',
    "baseSalary" DECIMAL(14,2) NOT NULL,
    "status" "RhEmployeeStatus" NOT NULL DEFAULT 'ACTIVO',
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankIban" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhEmployee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhContract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "RhContractType" NOT NULL,
    "status" "RhContractStatus" NOT NULL DEFAULT 'RASCUNHO',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "salary" DECIMAL(14,2) NOT NULL,
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhContract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RhAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RhDepartment_tenantId_name_key" ON "RhDepartment"("tenantId", "name");
CREATE INDEX "RhDepartment_tenantId_parentId_idx" ON "RhDepartment"("tenantId", "parentId");
CREATE UNIQUE INDEX "RhPosition_tenantId_title_departmentId_key" ON "RhPosition"("tenantId", "title", "departmentId");
CREATE INDEX "RhPosition_tenantId_departmentId_idx" ON "RhPosition"("tenantId", "departmentId");
CREATE UNIQUE INDEX "RhEmployee_tenantId_employeeNumber_key" ON "RhEmployee"("tenantId", "employeeNumber");
CREATE INDEX "RhEmployee_tenantId_status_idx" ON "RhEmployee"("tenantId", "status");
CREATE INDEX "RhEmployee_tenantId_departmentId_idx" ON "RhEmployee"("tenantId", "departmentId");
CREATE INDEX "RhEmployee_tenantId_positionId_idx" ON "RhEmployee"("tenantId", "positionId");
CREATE INDEX "RhContract_tenantId_employeeId_idx" ON "RhContract"("tenantId", "employeeId");
CREATE INDEX "RhContract_tenantId_status_endDate_idx" ON "RhContract"("tenantId", "status", "endDate");
CREATE INDEX "RhAuditLog_tenantId_createdAt_idx" ON "RhAuditLog"("tenantId", "createdAt");
CREATE INDEX "RhAuditLog_tenantId_entity_entityId_idx" ON "RhAuditLog"("tenantId", "entity", "entityId");

ALTER TABLE "RhDepartment" ADD CONSTRAINT "RhDepartment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhDepartment" ADD CONSTRAINT "RhDepartment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RhDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RhPosition" ADD CONSTRAINT "RhPosition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPosition" ADD CONSTRAINT "RhPosition_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "RhDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RhEmployee" ADD CONSTRAINT "RhEmployee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhEmployee" ADD CONSTRAINT "RhEmployee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "RhDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RhEmployee" ADD CONSTRAINT "RhEmployee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "RhPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RhContract" ADD CONSTRAINT "RhContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhContract" ADD CONSTRAINT "RhContract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhAuditLog" ADD CONSTRAINT "RhAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: isolamento estrito por empresa nas tabelas do núcleo RH.
ALTER TABLE "RhDepartment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhPosition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhEmployee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhContract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhAuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_department_isolation" ON "RhDepartment" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "rh_position_isolation" ON "RhPosition" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "rh_employee_isolation" ON "RhEmployee" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "rh_contract_isolation" ON "RhContract" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
CREATE POLICY "rh_audit_isolation" ON "RhAuditLog" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
