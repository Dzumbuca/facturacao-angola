'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createAccount, updateAccount, deactivateAccount } from '@/lib/gl-account-actions';

type Account = { id: string; code: string; name: string; kind: string; nature: string | null; synthetic: boolean; parentId: string | null };

export function AccountActions({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  type Editing = { code: string; name: string; kind: string; nature: string; synthetic: boolean; parentId: string | null };
  const [draft, setDraft] = useState<Editing>({ code: '', name: '', kind: 'ASSET', nature: 'DEBIT', synthetic: false, parentId: null });

  const submitCreate = () => {
    setError(''); setSuccess('');
    if (!draft.code.trim() || !draft.name.trim()) { setError('Código e nome obrigatórios.'); return; }
    start(async () => {
      try {
        await createAccount(draft);
        setSuccess('Conta criada.');
        setDraft({ code: '', name: '', kind: 'ASSET', nature: 'DEBIT', synthetic: false, parentId: null });
        setCreating(false);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Falha.');
      }
    });
  };

  const submitDeactivate = (id: string) => {
    if (!confirm('Desativar conta? Mantém histórico, não aceita novos lançamentos.')) return;
    start(async () => {
      try {
        await deactivateAccount(id);
        setSuccess('Conta desactivada.');
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Falha.');
      }
    });
  };

  const submitEdit = () => {
    if (!editing) return;
    start(async () => {
      try {
        await updateAccount(editing.id, { name: editing.name, kind: editing.kind, nature: editing.nature ?? undefined, synthetic: editing.synthetic, parentId: editing.parentId });
        setSuccess('Conta atualizada.');
        setEditing(null);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Falha.');
      }
    });
  };

  const startEdit = (a: Account) => {
    setEditing({ ...a });
    setError(''); setSuccess('');
  };

  return (
    <div className="space-y-3">
      <button onClick={() => setCreating((v) => !v)} className="h-11 rounded-xl bg-[#021f87] px-5 text-sm font-semibold text-white hover:bg-[#011566]">+ Nova conta</button>

      {creating && (
        <div className="rounded-2xl border border-[#e2e9f1] bg-[#f7fbff] p-4">
          <h4 className="font-bold text-[#1c2d3f]">Nova conta</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="Código (ex.: 1150)" className="rounded-xl border p-2 text-sm" required />
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Designação" className="rounded-xl border p-2 text-sm" required />
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className="rounded-xl border p-2 text-sm">
              {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((k) => <option key={k}>{k}</option>)}
            </select>
            <select value={draft.nature} onChange={(e) => setDraft({ ...draft, nature: e.target.value })} className="rounded-xl border p-2 text-sm">
              <option value="DEBIT">DEBIT</option>
              <option value="CREDIT">CREDIT</option>
            </select>
            <select value={draft.parentId ?? ''} onChange={(e) => setDraft({ ...draft, parentId: e.target.value || null })} className="rounded-xl border p-2 text-sm">
              <option value="">Sem conta superior</option>
              {accounts.filter((a) => a.kind === draft.kind).map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.synthetic} onChange={(e) => setDraft({ ...draft, synthetic: e.target.checked })} /> Sintética</label>
          </div>
          {error && <p role="alert" className="mt-2 border-l-4 border-red-500 bg-red-50 px-3 py-1 text-xs text-red-700">{error}</p>}
          {success && <p className="mt-2 border-l-4 border-emerald-500 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{success}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setCreating(false)} className="h-10 rounded-xl border border-[#e2e9f1] bg-white px-4 text-xs font-semibold text-[#627068]">Cancelar</button>
            <button disabled={isPending} onClick={submitCreate} className="h-10 rounded-xl bg-[#021f87] px-4 text-xs font-semibold text-white hover:bg-[#011566]">Criar</button>
          </div>
        </div>
      )}

      {editing && (
        <div className="rounded-2xl border border-[#e2e9f1] bg-[#fffbf0] p-4">
          <h4 className="font-bold text-[#1c2d3f]">Editar conta {editing.code}</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="rounded-xl border p-2 text-sm" />
            <select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })} className="rounded-xl border p-2 text-sm">
              {['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((k) => <option key={k}>{k}</option>)}
            </select>
            <select value={editing.nature ?? ''} onChange={(e) => setEditing({ ...editing, nature: e.target.value || null })} className="rounded-xl border p-2 text-sm">
              <option value="DEBIT">DEBIT</option>
              <option value="CREDIT">CREDIT</option>
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.synthetic} onChange={(e) => setEditing({ ...editing, synthetic: e.target.checked })} /> Sintética</label>
          </div>
          {error && <p role="alert" className="mt-2 border-l-4 border-red-500 bg-red-50 px-3 py-1 text-xs text-red-700">{error}</p>}
          <div className="mt-3 flex gap-2 justify-end">
            <button onClick={() => setEditing(null)} className="h-10 rounded-xl border border-[#e2e9f1] bg-white px-4 text-xs font-semibold text-[#627068]">Cancelar</button>
            <button disabled={isPending} onClick={submitEdit} className="h-10 rounded-xl bg-[#021f87] px-4 text-xs font-semibold text-white">Guardar</button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-[#edf1f5]">
        {accounts.length === 0 ? <li className="p-3 text-xs text-[#708195]">Sem contas activas.</li> : accounts.map((a) => (
          <li key={a.id} className="grid grid-cols-[80px_1fr_auto] items-center gap-2 px-3 py-2 hover:bg-[#fafcfd]">
            <span className="font-mono text-[#2878d0]">{a.code}{a.synthetic ? ' (S)' : ''}</span>
            <span className="truncate text-sm text-[#1c2d3f]">{a.name}</span>
            <span className="flex gap-2">
              <button onClick={() => startEdit(a)} className="text-xs font-semibold text-[#2878d0]">Editar</button>
              <button onClick={() => submitDeactivate(a.id)} className="text-xs font-semibold text-[#a83939]">Desativar</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
