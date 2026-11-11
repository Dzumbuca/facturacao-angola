import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { EmployeesManager } from '@/components/rh/employees-manager';

export default async function RhEmployeesPage() {
  const access = await requireRhPage();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const [employees, departments, positions, shifts] = await Promise.all([
      tx.rhEmployee.findMany({
        where: { tenantId: access.tenantId },
        include: { department: { select: { id: true, name: true } }, position: { select: { id: true, title: true } } },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      tx.rhDepartment.findMany({ where: { tenantId: access.tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      tx.rhPosition.findMany({ where: { tenantId: access.tenantId }, select: { id: true, title: true, departmentId: true }, orderBy: { title: 'asc' } }),
      tx.rhShift.findMany({ where: { tenantId: access.tenantId, isActive: true }, select: { id: true, name: true, startTime: true, endTime: true }, orderBy: { name: 'asc' } }),
    ]);
    return { employees, departments, positions, shifts };
  }, { userId: access.userId });

  return (
    <EmployeesManager
      initialEmployees={(data.employees as any[]).map((employee) => ({
        ...employee,
        birthDate: employee.birthDate ? employee.birthDate.toISOString() : null,
        hireDate: employee.hireDate.toISOString(),
        baseSalary: Number(employee.baseSalary),
      }))}
      departments={data.departments}
      positions={data.positions}
      shifts={data.shifts as any}
    />
  );
}
