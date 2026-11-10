import { requireRhAccess } from '@/lib/rh-access';

export default async function RhSettingsPage() {
  const access = await requireRhAccess();
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[#708195]">Administração</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Configurações</h1>
        <p className="mt-1 text-sm text-[#607286]">Estado do módulo, permissões e privacidade.</p>
      </div>

      <section className="rounded-xl border border-[#e1e8f0] bg-white p-5">
        <h2 className="text-sm font-bold text-[#1c2d3f]">Acesso</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-[#708195]">Perfil</dt><dd className="font-semibold">{access.tenantRole}</dd></div>
          <div><dt className="text-[#708195]">Módulo</dt><dd className="font-semibold text-[#267256]">Activo</dd></div>
        </dl>
        <p className="mt-4 rounded-lg bg-[#f5f8fc] p-3 text-xs text-[#607286]">
          A matriz fina de permissões (RH_ADMIN, FINANCE, MANAGER, EMPLOYEE) será introduzida com a fase de assiduidade e payroll.
        </p>
      </section>

      <section className="rounded-xl border border-[#e1e8f0] bg-white p-5">
        <h2 className="text-sm font-bold text-[#1c2d3f]">Privacidade e dados</h2>
        <ul className="mt-3 space-y-2 text-sm text-[#607286]">
          <li>Dados isolados por empresa; todas as consultas passam pelo contexto do tenant.</li>
          <li>Salários e dados bancários só são devolvidos a perfis autorizados.</li>
          <li>Cada criação/alteração de funcionário, contrato, departamento e cargo é auditada.</li>
          <li>Biometria não é armazenada; o Machine Point usará QR/PIN e integração por dispositivo.</li>
        </ul>
      </section>
    </div>
  );
}
