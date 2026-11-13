'use client';

import { parseDocumentBlocks, parseInlineRuns } from '@/lib/document-blocks';

export type PreviewIdentity = {
  name?: string;
  legalName?: string;
  nif?: string;
  address?: string;
  phone?: string;
  email?: string;
};

function Inline({ runs }: { runs: ReturnType<typeof parseInlineRuns> }) {
  return <>{runs.map((run, i) => {
    const key = `r${i}`;
    if (run.bold) return <strong key={key}>{run.text}</strong>;
    if (run.italic) return <em key={key}>{run.text}</em>;
    if (run.code) return <code key={key} className="rounded bg-slate-100 px-1 font-mono text-[10px]">{run.text}</code>;
    return <span key={key}>{run.text}</span>;
  })}</>;
}

export function AiDocumentPreview({ title, body, identity }: { title: string; body: string; identity?: PreviewIdentity }) {
  const blocks = parseDocumentBlocks(body);
  const showHeader = !!(identity?.legalName || identity?.name);
  return (
    <div className="h-full overflow-y-auto rounded-xl border border-[#e1e8f0] bg-[#f6f7fb] p-4">
      <div className="mx-auto max-w-[680px] rounded-[4px] bg-white p-8 shadow-[var(--shadow-card)]" style={{ minHeight: '900px' }}>
        {showHeader && (
          <div className="border-b-2 border-[#021f87] pb-3">
            <p className="text-sm font-bold uppercase tracking-[.1em] text-[#021f87]">{identity!.legalName || identity!.name}</p>
            <p className="mt-0.5 text-[9px] leading-4 text-[#647184]">{[identity!.address, identity!.nif ? `NIF ${identity!.nif}` : null, identity!.phone, identity!.email].filter(Boolean).join('  ·  ')}</p>
          </div>
        )}
        <h1 className="mt-4 text-xl font-extrabold leading-tight text-[#021f87]">{title}</h1>
        <div className="mt-3 space-y-2 text-[11px] leading-[1.65] text-[#171c27]">
          {blocks.map((block, i) => {
            switch (block.kind) {
              case 'heading': {
                const style = block.level === 1
                  ? 'text-[13px] font-bold uppercase tracking-wide text-[#021f87] mt-4 mb-1'
                  : block.level === 2
                    ? 'text-[11px] font-bold text-[#1c2d3f] mt-3 mb-1'
                    : block.level === 3
                      ? 'text-[10px] font-semibold text-[#24364d] mt-2'
                      : 'text-[9px] font-semibold uppercase tracking-wide text-[#647184] mt-1.5';
                return <p key={i} className={style}><Inline runs={parseInlineRuns(block.text)} /></p>;
              }
              case 'paragraph':
                return <p key={i} className="text-justify"><Inline runs={parseInlineRuns(block.text)} /></p>;
              case 'bullets':
                return <ul key={i} className="list-disc space-y-0.5 pl-5">{block.items.map((item, j) => <li key={j}><Inline runs={parseInlineRuns(item)} /></li>)}</ul>;
              case 'numbered':
                return <ol key={i} className="list-decimal space-y-0.5 pl-5">{block.items.map((item, j) => <li key={j}><Inline runs={parseInlineRuns(item)} /></li>)}</ol>;
              case 'table':
                return (
                  <div key={i} className="overflow-x-auto">
                    <table className="my-2 w-full border-collapse text-[9.5px]">
                      <thead>
                        <tr>{block.rows[0].map((cell, j) => <th key={j} className="border border-[#dde3ee] bg-[#e7ecf8] px-1.5 py-1 text-left font-bold text-[#021f87]">{cell}</th>)}</tr>
                      </thead>
                      <tbody>
                        {block.rows.slice(1).map((row, j) => (
                          <tr key={j} className={j % 2 === 0 ? 'bg-[#f3f6fa]' : ''}>
                            {row.map((cell, k) => <td key={k} className="border border-[#dde3ee] px-1.5 py-1 align-top"><Inline runs={parseInlineRuns(cell)} /></td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              case 'signature':
                return (
                  <div key={i} className="mt-8 text-center">
                    <div className="mx-auto w-64 border-t border-[#171c27] pt-1">
                      <p className="text-[10px] font-semibold text-[#171c27]">{identity?.legalName || identity?.name || block.label}</p>
                      <p className="text-[8px] uppercase tracking-wide text-[#647184]">Assinatura</p>
                    </div>
                  </div>
                );
              case 'hr':
                return <hr key={i} className="my-3 border-[#dce2ea]" />;
            }
          })}
          <p className="mt-6 border-t border-[#e7ecf3] pt-2 text-center text-[8px] uppercase tracking-[.14em] text-[#a3adbf]">Rascunho gerado por IA · Machine RH</p>
        </div>
      </div>
    </div>
  );
}
