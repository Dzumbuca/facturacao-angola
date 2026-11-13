'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { suggestionsForPath } from '@/lib/assistant-knowledge';
import { AssistantDocumentCard, type AssistantDocument } from './assistant-document-card';

type AssistantAction = { label: string; href: string };
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; actions?: AssistantAction[]; document?: AssistantDocument | null; offline?: boolean };

const STORAGE_KEY = 'machine-ia-history-v1';
const ASSISTANT_NAME = 'Machine IA';
const ASSISTANT_TAGLINE = 'Assistente empresarial';

const welcomeMessage = (): ChatMessage => ({
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! Sou o Machine IA, o seu assistente empresarial. Posso explicar como usar cada parte do sistema, ensinar passo a passo e ajudar a criar documentos.\n\nExperimente: «Como emitir uma factura?»',
});

function loadHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return [welcomeMessage()];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [welcomeMessage()];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [welcomeMessage()];
    return parsed;
  } catch { return [welcomeMessage()]; }
}

function saveHistory(messages: ChatMessage[]) {
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch { /* ignore */ }
}

/** Renderizador mínimo de Markdown-lite: listas, negrito e itálico. */
function renderInline(text: string, keyBase: string) {
  const parts: React.ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0; let i = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index !== undefined && match.index > last) parts.push(text.slice(last, match.index));
    const chunk = match[1] ?? match[2] ?? '';
    if (match[3] !== undefined) parts.push(<em key={`${keyBase}e${i++}`}>{match[3]}</em>);
    else if (match[1] !== undefined || match[2] !== undefined) parts.push(<strong key={`${keyBase}b${i++}`}>{chunk}</strong>);
    else if (match[4] !== undefined) parts.push(<code key={`${keyBase}c${i++}`} className="rounded bg-[#eef1f7] px-1 font-mono text-[12px] text-[#1c2d3f]">{match[4]}</code>);
    if (match.index !== undefined) last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderContent(content: string) {
  const lines = content.split('\n');
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      return <li key={idx} className="ml-5 list-outside list-decimal text-[13px] leading-6 text-current">{renderInline(numbered[2], `n${idx}`)}</li>;
    }
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      return <li key={idx} className="ml-5 list-outside list-disc text-[13px] leading-6 text-current">{renderInline(bullet[1], `b${idx}`)}</li>;
    }
    if (!trimmed) return <div key={idx} className="h-1.5" />;
    return <p key={idx} className="text-[13px] leading-6 text-current">{renderInline(line, `p${idx}`)}</p>;
  });
}



export function Assistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage()]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setMessages(loadHistory()); }, []);
  useEffect(() => { saveHistory(messages); }, [messages]);
  useEffect(() => { setUnread(false); }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || sending) return;
    setInput('');
    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    const next = [...messages, userMessage];
    setMessages(next);
    setSending(true);
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname, messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (response.status === 401 || response.status === 403) {
        setMessages([...next, { id: `a-${Date.now()}`, role: 'assistant', content: 'A sua sessão expirou. Volte a iniciar sessão para continuar.', offline: true }]);
        return;
      }
      if (response.status === 429) {
        setMessages([...next, { id: `a-${Date.now()}`, role: 'assistant', content: 'Demasiados pedidos. Aguarde um minuto e tente novamente.', offline: true }]);
        return;
      }
      if (!response.ok) throw new Error('assistant-failed');
      const data = await response.json();
      setMessages([...next, { id: `a-${Date.now()}`, role: 'assistant', content: data?.text ?? 'Não consegui responder. Tente novamente.', actions: data?.actions ?? [], document: data?.document ?? null, offline: !!data?.offline }]);
    } catch {
      setMessages([...next, { id: `a-${Date.now()}`, role: 'assistant', content: 'Não consegui contactar o assistente. Verifique a ligação e tente novamente.', offline: true }]);
    } finally {
      setSending(false);
    }
  }, [messages, sending, pathname]);

  const suggestions = suggestionsForPath(pathname);

  return (
    <>
      <button
        id="machine-ia-launcher"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Fechar o Machine IA' : `Abrir o ${ASSISTANT_NAME}`}
        aria-expanded={open}
        className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#021f87] text-white shadow-[0_10px_30px_rgba(2,31,135,.45)] transition hover:scale-105 hover:bg-[#1233a8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7795ff] md:bottom-6 md:right-6"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2l1.6 4.7L18.3 8.3l-4.7 1.6L12 14.6l-1.6-4.7L5.7 8.3l4.7-1.6L12 2z" fill="#a9bfff" />
          <path d="M19 13l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" fill="#ffffff" opacity=".92" />
        </svg>
        {unread && <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-[#071936] bg-[#ffb020]" />}
      </button>

      {open && (
        <div role="dialog" aria-label={`${ASSISTANT_NAME} — assistente`} className="fixed bottom-44 right-4 z-50 flex h-[min(640px,calc(100dvh-11.5rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_24px_60px_rgba(6,27,56,.35)] md:bottom-24 md:right-6 md:h-[min(660px,calc(100dvh-7rem))]">
          <div className="flex items-center gap-3 border-b border-[#e6ebf3] bg-gradient-to-r from-[#071936] to-[#021f87] px-4 py-3 text-white">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2l1.6 4.7 4.7 1.6-4.7 1.6L12 14.6l-1.6-4.7-4.7-1.6 4.7-1.6L12 2z" fill="#a9bfff" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">{ASSISTANT_NAME}</p>
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[.12em] text-blue-200/90"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> {ASSISTANT_TAGLINE}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-lg p-1.5 text-blue-100/80 transition hover:bg-white/10 hover:text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-[#fbfcfe] px-3 py-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3 py-2 shadow-sm ${message.role === 'user' ? 'rounded-br-md bg-[#021f87] text-white' : 'rounded-bl-md border border-[#e6ebf3] bg-white'}`}>
                  <div className="space-y-1">{renderContent(message.content)}</div>
                  {message.document && (
                    <AssistantDocumentCard
                      doc={message.document}
                      regenerating={sending}
                      onRegenerate={(instruction) => {
                        const context = message.document ? `O documento actual intitula-se "${message.document.title}" e o seu conteúdo é:

${message.document.body}` : '';
                        send(`Regenera o documento anterior com as seguintes instruções, devolvendo apenas o documento completo e pronto: ${instruction}
${context}`);
                      }}
                    />
                  )}
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.actions.map((action) => (
                        <Link key={`${action.href}-${action.label}`} href={action.href} onClick={() => setOpen(false)} className="inline-flex items-center gap-1 rounded-lg bg-[#eef2ff] px-2.5 py-1.5 text-[11px] font-semibold text-[#021f87] transition hover:bg-[#e0e7ff]"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>{action.label}</Link>
                      ))}
                    </div>
                  )}
                  {message.offline && message.role === 'assistant' && <p className="mt-1 text-[9px] uppercase tracking-[.1em] text-[#94a3b8]">modo offline · resposta da base de conhecimento</p>}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#e6ebf3] bg-white px-3 py-2"><span className="h-2 w-2 animate-bounce rounded-full bg-[#8aa1bd]" style={{ animationDelay: '0ms' }} /><span className="h-2 w-2 animate-bounce rounded-full bg-[#8aa1bd]" style={{ animationDelay: '150ms' }} /><span className="h-2 w-2 animate-bounce rounded-full bg-[#8aa1bd]" style={{ animationDelay: '300ms' }} /></div></div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 border-t border-[#e6ebf3] bg-white px-3 py-2">
              {suggestions.slice(0, 4).map((s) => (
                <button key={s.label} type="button" onClick={() => s.href ? (window.location.href = s.href) : send(s.prompt ?? s.label)} className="rounded-full border border-[#dfe7f1] bg-[#f7f9fd] px-2.5 py-1 text-[10px] font-medium text-[#3b5373] transition hover:border-[#021f87] hover:text-[#021f87]">{s.label}</button>
              ))}
            </div>
          )}

          <form onSubmit={(event) => { event.preventDefault(); send(input); }} className="flex items-end gap-2 border-t border-[#e6ebf3] bg-white p-2">
            <textarea ref={inputRef} id="machine-ia-input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} rows={1} placeholder="Pergunte qualquer coisa…" aria-label="Mensagem para o Machine IA" className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border border-[#e1e8f0] bg-[#f8fafd] px-3 py-2.5 text-[13px] leading-5 outline-none focus:border-[#021f87] focus:bg-white" />
            <button type="submit" disabled={sending || !input.trim()} aria-label="Enviar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#021f87] text-white transition hover:bg-[#1233a8] disabled:opacity-40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12L20 4l-4 16-4.5-6L4 12z" fill="currentColor" /></svg>
            </button>
          </form>
          <p className="border-t border-[#eef1f7] bg-white px-3 py-1 text-center text-[9px] uppercase tracking-[.14em] text-[#aab8cc]">Machine IA · respostas baseadas na plataforma</p>
        </div>
      )}
    </>
  );
}
