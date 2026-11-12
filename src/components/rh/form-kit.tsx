import { type ReactNode } from 'react';

/** Secção com título, descrição curta e conteúdo consistente para formulários RH. */
export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-[11px] font-bold uppercase tracking-[.12em] text-[#8a99ab]">{title}</legend>
      {description && <p className="text-xs text-[#708195]">{description}</p>}
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

type Base = { label: string; name?: string; required?: boolean; error?: string; hint?: string; children: ReactNode };

/** Campo com label acima, dica opcional, asterisco e erro junto ao campo. */
export function FormField({ label, name, required, error, hint, children }: Base) {
  const id = name ?? `rh-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="space-y-1">
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
      <button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-[#cdddeb] px-4 text-sm font-semibold text-[#52667a] hover:bg-[#f3f6fa]">Cancelar</button>
      <button type="submit" disabled={saving || disabled} className="min-h-10 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'A guardar…' : (saveLabel ?? 'Guardar')}</button>
    </div>
  );
}

/** Alerta de erro de servidor / validação. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[#a83939]">{children}</p>;
}

/** Mensagem de sucesso transitória. */
export function FormSuccess({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="status" className="rounded-lg bg-[#eff9f4] px-3 py-2 text-sm text-[#267256]">{children}</p>;
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
  return <input id={id} name={name} className={`app-input ${className ?? ''}`} {...props} />;
}

export function FormSelect({ id, name, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select id={id} name={name} className={`app-input ${className ?? ''}`} {...props} />;
}

export function FormTextarea({ id, name, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea id={id} name={name} className={`app-input min-h-20 ${className ?? ''}`} {...props} />;
}
