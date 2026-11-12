import 'server-only';

import { sendAndRecordEmail } from './email-actions';
import { escapeEmailHtml } from './email-core';

export async function sendEmployeeWelcomeEmail(input: {
  to: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  hireDate: Date | null;
  departmentName?: string | null;
  positionTitle?: string | null;
  companyName?: string | null;
  tenantId: string;
}) {
  const hire = input.hireDate ? new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' }).format(input.hireDate) : '—';
  const name = `${input.firstName} ${input.lastName}`.trim();
  const body = [
    `Olá ${input.firstName},`,
    ``,
    `É com muito gosto que te damos as boas-vindas${input.companyName ? ` à ${input.companyName}` : ''}!`,
    ``,
    `Os teus dados como colaborador foram registados no Machine RH:`,
    `• Nome: ${name}`,
    `• Número de funcionário: ${input.employeeNumber}`,
    `• Data de admissão: ${hire}`,
    `• Departamento: ${input.departmentName ?? 'A definir'}`,
    `• Cargo: ${input.positionTitle ?? 'A definir'}`,
    ``,
    `Em breve vais receber os teus acessos ao portal do funcionário (Meu RH), onde poderás consultar contracheques, horários, férias e muito mais.`,
    ``,
    `Se tiveres alguma questão, fala com a equipa de RH.`,
    ``,
    `Bem-vindo(a) à equipa!`,
    ``,
    `— Machine RH`,
  ].join('\n');

  return sendAndRecordEmail({
    purpose: 'EMPLOYEE_WELCOME',
    tenantId: input.tenantId,
    to: input.to,
    subject: `Bem-vindo(a) ao Machine RH — nº ${input.employeeNumber}`,
    text: body,
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1c2d3f">
<h2 style="color:#021f87;margin:0 0 8px">Bem-vindo(a), ${escapeEmailHtml(input.firstName)}!</h2>
<p>É com muito gosto que te damos as boas-vindas${input.companyName ? ` à <strong>${escapeEmailHtml(input.companyName)}</strong>` : ''}.</p>
<p>Os teus dados como colaborador foram registados no <strong>Machine RH</strong>:</p>
<ul>
<li><strong>Nome:</strong> ${escapeEmailHtml(name)}</li>
<li><strong>Nº funcionário:</strong> ${escapeEmailHtml(input.employeeNumber)}</li>
<li><strong>Admissão:</strong> ${escapeEmailHtml(hire)}</li>
<li><strong>Departamento:</strong> ${escapeEmailHtml(input.departmentName ?? 'A definir')}</li>
<li><strong>Cargo:</strong> ${escapeEmailHtml(input.positionTitle ?? 'A definir')}</li>
</ul>
<p>Em breve vais receber os teus acessos ao portal do funcionário (Meu RH), onde poderás consultar contracheques, horários, férias e muito mais.</p>
<p>Se tiveres alguma questão, fala com a equipa de RH.</p>
<p><strong>Bem-vindo(a) à equipa!</strong></p>
<p style="color:#708195;font-size:12px">— Machine RH</p>
</div>`,
  });
}
