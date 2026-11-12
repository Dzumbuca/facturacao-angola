'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormField, FormActions, FormError } from '@/components/rh/form-kit';
type Member = { id: string; role: string; user: { email: string; name: string | null } };
const ROLES: Record<string, string> = { ADMIN: 'Administrador RH', MANAGER: 'Gestor RH', FINANCE: 'Financeiro' };

export function MembersManager({ members }: { members: Member[] }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MANAGER');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/rh/members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível guardar.');
      setMessage('Função atribuída.');
      setEmail('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function change(id: string, role: string) {
    setError(''); setMessage('');
    try {
      const response = await fetch(`/api/rh/members/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error('Não foi possível actualizar.');
      setMessage('Função actualizada.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[#708195]">Administração</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Equipa RH</h1>
        <p className="mt-1 text-sm text-[#607286]">Funções por empresa. O administrador da empresa mantém acesso total.</p>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
        <FormSection title="Adicionar membro RH">
          <div className="sm:col-span-2">
            <FormField label="Email do utilizador" name="member-email" required><input id="member-email" type="email" className="app-input" value={email} onChange={(e) => setEmail(e.target.value)} required /></FormField>
          </div>
          <div>
            <FormField label="Função" name="member-role">
              <select id="member-role" className="app-input" value={role} onChange={(e) => setRole(e.target.value)}>{Object.entries(ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </FormField>
          </div>
        </FormSection>
        {message && <p role="status" className="mt-2 text-xs font-medium text-[#267256]">{message}</p>}
        <FormError>{error}</FormError>
        <div className="mt-3 flex justify-end">
          <FormActions saving={saving} onCancel={() => {}} saveLabel={saving ? 'A guardar…' : 'Atribuir função'} />
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[#e1e8f0] bg-white">
        <table className="data-table min-w-[560px]">
          <thead><tr><th>Utilizador</th><th>Email</th><th>Função</th></tr></thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td data-mobile-primary className="font-semibold text-[#1c2d3f]">{member.user.name ?? '—'}</td>
                <td className="text-xs">{member.user.email}</td>
                <td>
                  <select className="app-input max-w-48 text-xs" value={member.role} onChange={(e) => change(member.id, e.target.value)}>
                    {Object.entries(ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {members.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-[#708195]">Ainda não há funções atribuídas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
