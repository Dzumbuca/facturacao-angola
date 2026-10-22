import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: 'primary' | 'secondary' | 'quiet' };

export function Button({ children, className = '', variant = 'primary', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-[#2878D0] text-white shadow-sm hover:bg-[#216bbd]',
    secondary: 'border border-[#d8e1eb] bg-white text-[#30465c] hover:bg-[#f7f9fc]',
    quiet: 'bg-transparent text-[#52667a] hover:bg-[#f0f4f8]',
  };
  return <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}
