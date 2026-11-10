-- Machine Payroll — regras, processamento e recibos (aditivo; não aplicar em produção sem aprovação).

CREATE TYPE "RhPayrollStatus" AS ENUM ('RASCUNHO', 'CALCULADO', 'EM_REVISAO', 'APROVADO', 'PENDENTE_PAGAMENTO', 'PAGO', 'CANCELADO');

CREATE TABLE "RhPayrollRuleSet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhPayrollRuleSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhPayrollRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "rulesetId" TEXT,
    "status" "RhPayrollStatus" NOT NULL DEFAULT 'RASCUNHO',
    "totalGross" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalInss" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalIrt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhPayrollRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhPayslip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "baseSalary" DECIMAL(14,2) NOT NULL,
    "allowances" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "absences" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gross" DECIMAL(14,2) NOT NULL,
    "inss" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "irt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(14,2) NOT NULL,
    "lines" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RhPayslip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RhPayrollRuleSet_tenantId_name_key" ON "RhPayrollRuleSet"("tenantId", "name");
CREATE INDEX "RhPayrollRuleSet_tenantId_status_idx" ON "RhPayrollRuleSet"("tenantId", "status");
CREATE UNIQUE INDEX "RhPayrollRun_tenantId_period_key" ON "RhPayrollRun"("tenantId", "period");
CREATE INDEX "RhPayrollRun_tenantId_status_idx" ON "RhPayrollRun"("tenantId", "status");
CREATE UNIQUE INDEX "RhPayslip_runId_employeeId_key" ON "RhPayslip"("runId", "employeeId");
CREATE INDEX "RhPayslip_tenantId_employeeId_idx" ON "RhPayslip"("tenantId", "employeeId");

ALTER TABLE "RhPayrollRuleSet" ADD CONSTRAINT "RhPayrollRuleSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPayrollRun" ADD CONSTRAINT "RhPayrollRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPayrollRun" ADD CONSTRAINT "RhPayrollRun_rulesetId_fkey" FOREIGN KEY ("rulesetId") REFERENCES "RhPayrollRuleSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RhPayslip" ADD CONSTRAINT "RhPayslip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPayslip" ADD CONSTRAINT "RhPayslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RhPayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhPayslip" ADD CONSTRAINT "RhPayslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhPayrollRuleSet" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_payroll_ruleset_isolation" ON "RhPayrollRuleSet" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhPayrollRun" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_payroll_run_isolation" ON "RhPayrollRun" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhPayslip" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_payslip_isolation" ON "RhPayslip" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
