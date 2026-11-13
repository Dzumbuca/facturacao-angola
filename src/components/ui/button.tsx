import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: 'primary' | 'secondary' | 'quiet' };

export function Button({ children, className = '', variant = 'primary', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-[var(--blue)] text-white shadow-[var(--shadow-card)] hover:bg-[#0634b8]',
    secondary: 'border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-raised)]',
    quiet: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-raised)]',
  };
  return <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)] ${styles[variant]} ${className}`} {...props}>{children}</button>;
}
