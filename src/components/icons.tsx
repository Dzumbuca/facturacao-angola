// Ícones inline consistentes (traço 1.8, 24x24) — sem dependências externas.
type IconProps = { className?: string };

const base = 'h-5 w-5';

export function CheckIcon({ className = base }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
}

export function FileIcon({ className = base }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>;
}

export function ShieldIcon({ className = base }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 3 4.5 6v6c0 4.5 3.2 7.7 7.5 9 4.3-1.3 7.5-4.5 7.5-9V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></svg>;
}

export function DownloadIcon({ className = base }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 4v10" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M5 19h14" /></svg>;
}

export function LayersIcon({ className = base }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3 9 5-9 5-9-5z" /><path d="m4.5 12.5 7.5 4.2 7.5-4.2" /><path d="m4.5 16.5 7.5 4.2 7.5-4.2" /></svg>;
}

export function UsersIcon({ className = base }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c.7-3 2.9-4.6 5.5-4.6s4.8 1.6 5.5 4.6" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 4.9" /><path d="M17.5 15.2c1.6.7 2.7 2.1 3.1 4.3" /></svg>;
}

export function ChartIcon({ className = base }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 4v15a1 1 0 0 0 1 1h15" /><path d="M8.5 15.5v-4M12.5 15.5V8M16.5 15.5v-6.5" /></svg>;
}

export function SparkIcon({ className = base }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9z" /><path d="M18.5 3.5v3M17 5h3" /></svg>;
}

export function WhatsappIcon({ className = base }: IconProps) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.83 14.12c-.25.7-1.45 1.34-2.02 1.42-.52.08-1.17.11-1.89-.12-.44-.14-1-.32-1.72-.63-3.03-1.31-5.01-4.36-5.16-4.56-.16-.2-1.23-1.63-1.23-3.11 0-1.48.78-2.21 1.05-2.51.28-.3.6-.38.8-.38.2 0 .4 0 .58.01.19.01.44-.07.68.52.25.6.85 2.07.93 2.22.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.76 1.26 1.63 2.04 1.12 1 2.06 1.31 2.36 1.46.3.15.47.12.65-.07.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.22.57.35.07.12.07.72-.18 1.42z" /></svg>;
}

export const featureIcons = [FileIcon, ShieldIcon, DownloadIcon, LayersIcon, UsersIcon, ChartIcon];
