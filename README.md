# Machine Facturas

Sistema de facturação e gestão empresarial para o mercado angolano.

**Produção:** https://facturacao-angola.vercel.app
**Repositório:** github.com/Dzumbuca/facturacao-angola (branch `main`, deploy automático via Vercel)

## Tecnologias

- Next.js 16 + React 19 + TypeScript
- Prisma ORM + PostgreSQL (Supabase)
- NextAuth v5 (email/palavra-passe + Google OAuth)
- Tailwind CSS 4 + Vitest (125 testes)
- PDFKit (facturas assinadas digitalmente, padrão AGT) + exportação SAFT-AO

## Desenvolvimento

```bash
npm install          # instalar dependências
npm run dev          # servidor em http://localhost:3002
npm test             # suite de testes
npm run build        # build de produção
```

Copia `.env.example` para `.env` e preenche: `DATABASE_URL` (Supabase, pooler), `NEXTAUTH_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`/`KEY`, e `PRIVATE_KEY` (chave RSA que assina as facturas — ver `backups/`).

## Segurança

- Nunca publiques o ficheiro `.env`, chaves privadas ou tokens.
- `backups/invoice-signing-private-key.pem` assina todas as facturas — guardar para sempre, nunca regenerar.
- Rotas de autenticação têm rate limiting por IP (`src/lib/rate-limit.ts`).
- Confirma os requisitos fiscais aplicáveis junto da AGT (certificação de software facturativo).

## Publicar

`git add . && git commit -m "..." && git push` — a Vercel constrói e publica automaticamente.
