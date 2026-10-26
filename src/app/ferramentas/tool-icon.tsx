// Ícones de linha das ferramentas — traço fino, coerente com o design sóbrio
// do site. Sem biblioteca externa: SVGs pequenos e auditáveis.
const TRACO = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ICONES: Record<string, React.ReactNode> = {
  percent: (<><path d="M19 5 5 19" {...TRACO} /><circle cx="7.5" cy="7.5" r="2.5" {...TRACO} /><circle cx="16.5" cy="16.5" r="2.5" {...TRACO} /></>),
  exchange: (<><path d="M4 8h13M14 4.5 17.5 8 14 11.5" {...TRACO} /><path d="M20 16H7M10 12.5 6.5 16l3.5 3.5" {...TRACO} /></>),
  wallet: (<><rect x="3" y="6.5" width="18" height="13" rx="2.5" {...TRACO} /><path d="M3 10h18" {...TRACO} /><circle cx="16.8" cy="14.8" r="1.2" {...TRACO} /></>),
  'id-card': (<><rect x="3" y="5" width="18" height="14" rx="2.5" {...TRACO} /><circle cx="9" cy="11" r="2" {...TRACO} /><path d="M6 16.2c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2" {...TRACO} /><path d="M15 9.5h4M15 13h4M15 16.5h2.5" {...TRACO} /></>),
  'trending-up': (<><path d="M3.5 17.5 9.5 11l4 4 6.5-7" {...TRACO} /><path d="M15.5 8H20v4.5" {...TRACO} /></>),
  tag: (<><path d="M12.6 3.5H19a1.5 1.5 0 0 1 1.5 1.5v6.4a2 2 0 0 1-.6 1.4l-7 7a2 2 0 0 1-2.8 0l-5.4-5.4a2 2 0 0 1 0-2.8l7-7a2 2 0 0 1 1.4-.6Z" {...TRACO} /><circle cx="16" cy="8" r="1.3" {...TRACO} /></>),
  discount: (<><circle cx="12" cy="12" r="8.5" {...TRACO} /><path d="M15.5 8.5l-7 7" {...TRACO} /><circle cx="9.3" cy="9.3" r="1.4" {...TRACO} /><circle cx="14.7" cy="14.7" r="1.4" {...TRACO} /></>),
  scale: (<><path d="M12 4v16M8 20h8" {...TRACO} /><path d="M4.5 7h15" {...TRACO} /><path d="M6.5 7 4 12.5a2.8 2.8 0 0 0 5 0Z" {...TRACO} /><path d="M17.5 7 15 12.5a2.8 2.8 0 0 0 5 0Z" {...TRACO} /></>),
  'file-text': (<><path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z" {...TRACO} /><path d="M14 3.5V8h4.5" {...TRACO} /><path d="M9 12.5h6M9 16h4" {...TRACO} /></>),
  'file-check': (<><path d="M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z" {...TRACO} /><path d="M14 3.5V8h4.5" {...TRACO} /><path d="m9 14.5 2.2 2.2 4-4.2" {...TRACO} /></>),
  receipt: (<><path d="M6 3.5h12V20l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 20Z" {...TRACO} /><path d="M9.5 8h5M9.5 11.5h5M9.5 15h3" {...TRACO} /></>),
  table: (<><rect x="3.5" y="4.5" width="17" height="15" rx="2" {...TRACO} /><path d="M3.5 10h17M9.5 10v9.5M15.5 10v9.5" {...TRACO} /></>),
};

export function ToolIcon({ icone, className }: { icone: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {ICONES[icone] ?? ICONES['file-text']}
    </svg>
  );
}
