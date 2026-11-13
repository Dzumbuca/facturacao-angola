import { type ReactNode, useState } from 'react';

/** Secção premium: cartão branco com título, ícone e conteúdo consistente. */
export function FormSection({ title, description, children, tone = 'default' }: { title: string; description?: string; children: ReactNode; tone?: 'default' | 'soft' | 'danger' }) {
  const toneClass = tone === 'soft' ? 'bg-[#fbfcfe] border-[#e6eaf0] dark:bg-[#111f35] dark:border-[#1e2a44]' : tone === 'danger' ? 'bg-[#fff7f7] border-[#f0dada] dark:bg-red-950/30 dark:border-[#3a1e1e]' : 'bg-white border-[#e6eaf0] dark:bg-[#0d1627] dark:border-[#1e2a44]';
  return (
    <fieldset className={`space-y-4 rounded-[18px] border ${toneClass} dark:border-[#1e2a44] dark:bg-[#0d1526] p-4 shadow-[0_10px_28px_rgba(18,36,68,.05)] sm:p-5`}>
      <legend className="flex items-center gap-2 px-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#52667a] dark:text-[#9db1d8]">{title}</legend>
      {description && <p className="text-xs leading-5 text-[#8094a9] dark:text-[#7a8faf]">{description}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

type Base = { label: string; name?: string; required?: boolean; error?: string; hint?: string; children: ReactNode };

/** Campo com label acima, dica opcional, asterisco e erro junto ao campo. */
export function FormField({ label, name, required, error, hint, children }: Base) {
  const id = name ?? `rh-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="app-label">{label}{required && <span className="text-[#a83939]"> *</span>}</label>
      {children}
      {hint && !error && <p className="text-[11px] text-[#8a99ab]">{hint}</p>}
      {error && <p role="alert" className="text-xs font-medium text-[#a83939]">{error}</p>}
    </div>
  );
}

/** Linha de acções: cancelar + guardar. Mostra spinner no envio. */
export function FormActions({ saving, onCancel, saveLabel, disabled }: { saving?: boolean; onCancel: () => void; saveLabel?: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onCancel} className="min-h-12 rounded-[12px] border border-[#cdd6e3] bg-white px-5 text-sm font-semibold text-[#52667a] transition hover:bg-[#f3f6fa] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#021f87]/10">Cancelar</button>
      <button type="submit" disabled={saving || disabled} className="min-h-12 rounded-[12px] bg-gradient-to-br from-[#021f87] via-[#0b2b6b] to-[#1b3a7a] px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(2,31,135,.34)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(2,31,135,.4)] disabled:opacity-60">{saving ? 'A guardar…' : (saveLabel ?? 'Guardar')}</button>
    </div>
  );
}

/** Alerta de erro de servidor / validação. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-[14px] border border-[#f3d0d0] bg-[#fcf2f2] px-4 py-3 text-sm font-semibold text-[#a83939]">{children}</p>;
}

/** Mensagem de sucesso transitória. */
export function FormSuccess({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="status" className="rounded-[14px] border border-[#c7e5d1] bg-[#eff9f4] px-4 py-3 text-sm font-semibold text-[#267256]">{children}</p>;
}

/** Skeleton de carregamento. */
export function FormLoading({ label = 'A carregar…' }: { label?: string }) {
  return (
    <div aria-label={label} className="space-y-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-[#eef2f6]" />)}
    </div>
  );
}

/** Input standard com consistentee EC. */
export function FormInput({ id, name, className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input id={id} name={name} className={`app-input ${className ?? ''} dark:bg-[#111f35] dark:border-[#1e2a44] dark:text-slate-100`} {...props} />;
}

export function FormSelect({ id, name, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select id={id} name={name} className={`app-input ${className ?? ''} dark:bg-[#111f35] dark:border-[#1e2a44] dark:text-slate-100`} {...props} />;
}

export function FormTextarea({ id, name, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea id={id} name={name} className={`app-input min-h-20 ${className ?? ''}`} {...props} />;
}

/* ---------- Número em formato pt-AO (20.000,00) ---------- */

/** Converte texto "20.000,00" → 20000 (null se inválido). */
export function parsePtValue(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Formata número para "20.000,00". */
export function formatPtValue(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value);
}

/** Input de número ao estilo Angola: 20.000,00. Controlado externamente. */
export function CurrencyInput({ id, name, value, onChange, prefix = 'Kz', required = false, disabled = false, ariaLabel }: {
  id?: string; name?: string; value: number | null; onChange: (value: number | null) => void;
  prefix?: string; required?: boolean; disabled?: boolean; ariaLabel?: string;
}) {
  const defaultText = value === null ? '' : formatPtValue(value);
  return (
    <div>
      <label className="flex items-center gap-2 rounded-[10px] border border-[#e1e8f0] bg-[#f8fafc] px-3 focus-within:ring-2 focus-within:ring-[#1a3aa8]/40">
        <span className="select-none text-xs font-semibold text-[#607286]">{prefix}</span>
        <input
          id={id} inputMode="decimal" type="text"
          defaultValue={defaultText}
          aria-label={ariaLabel}
          disabled={disabled}
          onChange={(event) => {
            const parsed = parsePtValue(event.target.value);
            if (parsed !== null || event.target.value.trim() === '') onChange(parsed);
          }}
          onBlur={(event) => { event.currentTarget.value = value === null ? '' : formatPtValue(value); }}
          className="min-h-11 w-full bg-transparent text-right tabular-nums outline-none"
        />
      </label>
      <input type="hidden" name={name} value={value === null ? '' : String(value)} required={required} />
    </div>
  );
}

/* ---------- Calendário estilo Apple (iOS) ---------- */

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function toISO(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function fromISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}
function startOfGrid(date: Date): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  // Monday-first grid (Angola: weeks start on Monday)
  const offset = (first.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), 1 - offset);
}

/** Calendário pop-over estilo Apple com seleção única de data. */
export function CalendarField({ id, name, value, onChange, required = false, placeholder = 'DD/MM/AAAA' }: {
  id?: string; name?: string; value: string; onChange: (iso: string) => void; required?: boolean; placeholder?: string;
}) {
  const selected = fromISO(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => selected ?? new Date());

  const gridStart = startOfGrid(view);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const iso = (d: Date) => toISO(d);
  const isSelected = (d: Date) => iso(d) === value;
  const isToday = (d: Date) => iso(d) === iso(new Date());
  const inMonth = (d: Date) => d.getMonth() === view.getMonth();

  return (
    <div className="relative">
      <button
        id={id} type="button" aria-required={required || undefined}
        onClick={() => setOpen((v: boolean) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[10px] border border-[#e1e8f0] bg-[#f8fafc] px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#1a3aa8]/40"
      >
        <span className="tabular-nums">{selected ? formatPtDate(value) : placeholder}</span>
        <CalendarIcon />
      </button>
      <input type="hidden" name={name} value={value} />
      {open && (
        <div className="absolute z-50 mt-2 w-72 rounded-2xl border border-[#e1e8f0] bg-white p-3 shadow-xl" role="dialog" aria-label="Calendário">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Mês anterior" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="rounded-lg p-1 hover:bg-[#f1f5fb]"><NavIcon dir="left" /></button>
            <strong className="text-sm">{MONTHS_PT[view.getMonth()]} {view.getFullYear()}</strong>
            <button type="button" aria-label="Mês seguinte" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="rounded-lg p-1 hover:bg-[#f1f5fb]"><NavIcon dir="right" /></button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[#8a99ab]">
            {WEEKDAYS_PT.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              const active = isSelected(d);
              const today = isToday(d);
              return (
                <button
                  key={i} type="button"
                  onClick={() => { onChange(iso(d)); setOpen(false); }}
                  className={`h-9 rounded-lg text-xs font-semibold transition ${active ? 'bg-[#021f87] text-white' : inMonth(d) ? 'text-[#1c2d3f] hover:bg-[#eef4ff]' : 'text-[#b6c2ce]'} ${today && !active ? 'ring-1 ring-[#021f87]/40' : ''}`}
                >{d.getDate()}</button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between">
            <button type="button" onClick={() => { onChange(iso(new Date())); setOpen(false); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#021f87] hover:bg-[#eef4ff]">Hoje</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#607286] hover:bg-[#f1f5fb]">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatPtDate(iso: string): string {
  const d = fromISO(iso);
  return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : iso;
}
const CalendarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
);
const NavIcon = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{dir === 'left' ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}</svg>
);
