-- Formação profissional (aditivo; não aplicar em produção sem aprovação).

CREATE TYPE "RhTrainingStatus" AS ENUM ('AGENDADO', 'EM_CURSO', 'CONCLUIDO', 'CANCELADO');
CREATE TYPE "RhEnrollmentStatus" AS ENUM ('INSCRITO', 'CONCLUIDA', 'DESISTENTE');

CREATE TABLE "RhTrainingCourse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "trainerName" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "cargaHoras" INTEGER NOT NULL DEFAULT 8,
    "location" TEXT,
    "requiredForPositionId" TEXT,
    "status" "RhTrainingStatus" NOT NULL DEFAULT 'AGENDADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhTrainingCourse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RhTrainingEnrollment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "RhEnrollmentStatus" NOT NULL DEFAULT 'INSCRITO',
    "score" INTEGER,
    "certificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RhTrainingEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RhTrainingEnrollment_courseId_employeeId_key" ON "RhTrainingEnrollment"("courseId", "employeeId");
CREATE INDEX "RhTrainingCourse_tenantId_status_startDate_idx" ON "RhTrainingCourse"("tenantId", "status", "startDate");
CREATE INDEX "RhTrainingEnrollment_tenantId_courseId_status_idx" ON "RhTrainingEnrollment"("tenantId", "courseId", "status");

ALTER TABLE "RhTrainingCourse" ADD CONSTRAINT "RhTrainingCourse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhTrainingEnrollment" ADD CONSTRAINT "RhTrainingEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "RhTrainingCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RhTrainingEnrollment" ADD CONSTRAINT "RhTrainingEnrollment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "RhEmployee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RhTrainingCourse" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_training_course_isolation" ON "RhTrainingCourse" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "RhTrainingEnrollment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_training_enrollment_isolation" ON "RhTrainingEnrollment" FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
