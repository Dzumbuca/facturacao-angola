-- RLS policies for Machine Platform (Fase 1) new tables.
-- Idempotent: DROP + CREATE. Apply manually after review.
-- Requires: app.tenant_id set via set_config('app.tenant_id', <tenantId>, true) per request.

-- Enable RLS
ALTER TABLE "PlatformApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantSubscription" ENABLE ROW LEVEL SECURITY;

-- PlatformApplication: readable by all authenticated; writable by platform admins only.
DROP POLICY IF EXISTS "platform_app_read" ON "PlatformApplication";
CREATE POLICY "platform_app_read" ON "PlatformApplication"
  FOR SELECT USING (true);

-- SubscriptionPlan: readable by all authenticated.
DROP POLICY IF EXISTS "subscription_plan_read" ON "SubscriptionPlan";
CREATE POLICY "subscription_plan_read" ON "SubscriptionPlan"
  FOR SELECT USING (true);

-- PlanApplication: readable by all authenticated.
DROP POLICY IF EXISTS "plan_application_read" ON "PlanApplication";
CREATE POLICY "plan_application_read" ON "PlanApplication"
  FOR SELECT USING (true);

-- TenantApplication: strict tenant isolation (read + write).
DROP POLICY IF EXISTS "tenant_application_isolation" ON "TenantApplication";
CREATE POLICY "tenant_application_isolation" ON "TenantApplication"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- TenantSubscription: strict tenant isolation (read + write).
DROP POLICY IF EXISTS "tenant_subscription_isolation" ON "TenantSubscription";
CREATE POLICY "tenant_subscription_isolation" ON "TenantSubscription"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Machine RH (núcleo): isolamento estrito por empresa.
ALTER TABLE "RhDepartment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhPosition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhEmployee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhContract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RhAuditLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_department_isolation" ON "RhDepartment";
CREATE POLICY "rh_department_isolation" ON "RhDepartment" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS "rh_position_isolation" ON "RhPosition";
CREATE POLICY "rh_position_isolation" ON "RhPosition" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS "rh_employee_isolation" ON "RhEmployee";
CREATE POLICY "rh_employee_isolation" ON "RhEmployee" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS "rh_contract_isolation" ON "RhContract";
CREATE POLICY "rh_contract_isolation" ON "RhContract" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
DROP POLICY IF EXISTS "rh_audit_isolation" ON "RhAuditLog";
CREATE POLICY "rh_audit_isolation" ON "RhAuditLog" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Machine Point: registos de ponto isolados por empresa.
ALTER TABLE "RhTimeEntry" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_time_entry_isolation" ON "RhTimeEntry";
CREATE POLICY "rh_time_entry_isolation" ON "RhTimeEntry" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Machine Point: horários isolados por empresa.
ALTER TABLE "RhShift" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_shift_isolation" ON "RhShift";
CREATE POLICY "rh_shift_isolation" ON "RhShift" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Férias/licenças e configurações RH.
ALTER TABLE "RhLeaveRequest" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_leave_isolation" ON "RhLeaveRequest";
CREATE POLICY "rh_leave_isolation" ON "RhLeaveRequest" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhSettings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_settings_isolation" ON "RhSettings";
CREATE POLICY "rh_settings_isolation" ON "RhSettings" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Machine Point: dispositivos isolados por empresa.
ALTER TABLE "RhDevice" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_device_isolation" ON "RhDevice";
CREATE POLICY "rh_device_isolation" ON "RhDevice" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Machine Documents: modelos e documentos isolados por empresa.
ALTER TABLE "RhDocumentTemplate" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_doc_template_isolation" ON "RhDocumentTemplate";
CREATE POLICY "rh_doc_template_isolation" ON "RhDocumentTemplate" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhDocument" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_document_isolation" ON "RhDocument";
CREATE POLICY "rh_document_isolation" ON "RhDocument" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Machine Payroll: regras, runs e recibos isolados por empresa.
ALTER TABLE "RhPayrollRuleSet" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_payroll_ruleset_isolation" ON "RhPayrollRuleSet";
CREATE POLICY "rh_payroll_ruleset_isolation" ON "RhPayrollRuleSet" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhPayrollRun" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_payroll_run_isolation" ON "RhPayrollRun";
CREATE POLICY "rh_payroll_run_isolation" ON "RhPayrollRun" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhPayslip" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_payslip_isolation" ON "RhPayslip";
CREATE POLICY "rh_payslip_isolation" ON "RhPayslip" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Machine RH: funções por empresa.
ALTER TABLE "RhMember" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_member_isolation" ON "RhMember";
CREATE POLICY "rh_member_isolation" ON "RhMember" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Payroll Connect: lotes e itens isolados por empresa.
ALTER TABLE "RhPaymentBatch" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_payment_batch_isolation" ON "RhPaymentBatch";
CREATE POLICY "rh_payment_batch_isolation" ON "RhPaymentBatch" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhPaymentItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_payment_item_isolation" ON "RhPaymentItem";
CREATE POLICY "rh_payment_item_isolation" ON "RhPaymentItem" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Machine Documents: versões de modelos.
ALTER TABLE "RhDocumentTemplateVersion" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_doc_template_version_isolation" ON "RhDocumentTemplateVersion";
CREATE POLICY "rh_doc_template_version_isolation" ON "RhDocumentTemplateVersion" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Ciclo de vida: histórico salarial e desligamentos.
ALTER TABLE "RhSalaryChange" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_salary_change_isolation" ON "RhSalaryChange";
CREATE POLICY "rh_salary_change_isolation" ON "RhSalaryChange" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhOffboarding" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_offboarding_isolation" ON "RhOffboarding";
CREATE POLICY "rh_offboarding_isolation" ON "RhOffboarding" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Justificações e notificações.
ALTER TABLE "RhAbsenceJustification" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_absence_justification_isolation" ON "RhAbsenceJustification";
CREATE POLICY "rh_absence_justification_isolation" ON "RhAbsenceJustification" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhNotification" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_notification_isolation" ON "RhNotification";
CREATE POLICY "rh_notification_isolation" ON "RhNotification" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Recrutamento e seleção.
ALTER TABLE "RhJobOpening" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_job_opening_isolation" ON "RhJobOpening";
CREATE POLICY "rh_job_opening_isolation" ON "RhJobOpening" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhCandidate" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_candidate_isolation" ON "RhCandidate";
CREATE POLICY "rh_candidate_isolation" ON "RhCandidate" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhCandidateEvent" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_candidate_event_isolation" ON "RhCandidateEvent";
CREATE POLICY "rh_candidate_event_isolation" ON "RhCandidateEvent" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Avaliação de desempenho.
ALTER TABLE "RhPerformanceCycle" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_performance_cycle_isolation" ON "RhPerformanceCycle";
CREATE POLICY "rh_performance_cycle_isolation" ON "RhPerformanceCycle" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhPerfCriterion" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_perf_criterion_isolation" ON "RhPerfCriterion";
CREATE POLICY "rh_perf_criterion_isolation" ON "RhPerfCriterion" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhPerformanceReview" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_performance_review_isolation" ON "RhPerformanceReview";
CREATE POLICY "rh_performance_review_isolation" ON "RhPerformanceReview" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Formação profissional.
ALTER TABLE "RhTrainingCourse" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_training_course_isolation" ON "RhTrainingCourse";
CREATE POLICY "rh_training_course_isolation" ON "RhTrainingCourse" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhTrainingEnrollment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rh_training_enrollment_isolation" ON "RhTrainingEnrollment";
CREATE POLICY "rh_training_enrollment_isolation" ON "RhTrainingEnrollment" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
