import type { HTMLAttributes, ReactNode } from 'react';

type BlockProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };
export function Card({ children, className = '', ...props }: BlockProps) { return <section className={`rounded-2xl border border-[#e2e9f1] bg-white shadow-[0_3px_14px_rgba(25,52,80,.035)] ${className}`} {...props}>{children}</section>; }
export function CardContent({ children, className = '', ...props }: BlockProps) { return <div className={`p-5 md:p-6 ${className}`} {...props}>{children}</div>; }
export function CardHeader({ children, className = '', ...props }: BlockProps) { return <div className={`border-b border-[#e7edf3] px-5 py-4 md:px-6 ${className}`} {...props}>{children}</div>; }
export function CardTitle({ children, className = '', ...props }: BlockProps) { return <h2 className={`text-base font-bold text-[#1c2d3f] ${className}`} {...props}>{children}</h2>; }
