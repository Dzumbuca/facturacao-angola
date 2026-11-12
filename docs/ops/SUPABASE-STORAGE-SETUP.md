# Supabase Storage — preparação do upload de ficheiros (RH)

> **Não ejecutar em produção sem aprovação.** Este guia prepara apenas a integração. Nenhum bucket ou policy foi criado neste passo.

## Variáveis necessárias

No `.env.local` (dev) e na Vercel (Preview/Production):

| Variável | Origem | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Sim (já usada pela app) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role (secret) | **Sim** — só no servidor (`server-only`) |
| `SUPABASE_STORAGE_BUCKET_RH` | Nome do bucket (padrão `rh-uploads`) | Não |

**Nunca** colocar `SUPABASE_SERVICE_ROLE_KEY` em variáveis `NEXT_PUBLIC_*` nem em código cliente.

## Passos de configuração (manual, uma única vez)

1. Supabase → Storage → **New bucket**
   - Name: `rh-uploads`
   - Public: **ON** (se quiseres servir os ficheiros por URL pública; caso contrário mantém privado e usa signed URLs)
   - File size limit: 10 MB
   - MIME types: `application/pdf, image/png, image/jpeg, image/webp`
2. **Bucket PRIVADO** (public: OFF). O bucket público expõe fotos/CVs com URL directa — não usar.
   - Acesso é exclusivo do service_role; o upload/signed URL é feito no servidor.
   - Clientes só veem o bucket via endpoint `GET /api/rh/signed-url?path=...` (requer sessão RH).
3. No Vercel, adicionar as três variáveis acima e re-deploy (ou apenas correr `next build` fora de horário de pico).
4. Testar:
   - `curl -X POST -H "Authorization: Bearer <service_role_key>" https://<projeto>.supabase.co/storage/v1/bucket` → verás `rh-uploads` na lista.
   - No uploader da app, enviar um PDF pequeno e confirmar que a tabela `RhDocument`/funcionário recebe o URL.

## Como o código usa isto

- `src/lib/rh-storage.ts` — lê **exclusivamente** server-side (`server-only` import).
- `/api/rh/uploads` — endpoint autenticado (`employees:write`) que:
  - exige MIME válido (PDF/PNG/JPEG/WebP) e tamanho ≤ 10 MB;
  - cria o bucket automaticamente se não existir (ensureBucket);
  - devolve URL pública ou erro explícito (`STORAGE_NOT_CONFIGURED`, `BUCKET_ERROR_*`).
- Antes de usar, preencher as variáveis. Se faltarem, o endpoint responde **503** com `STORAGE_NOT_CONFIGURED` — **nunca finge que guardou**.

## Upload de ficheiros

- Upload via POST /api/rh/uploads (bucket privado; devolve path).
- Preview/download via GET /api/rh/signed-url?path=... (1h, requer sessão RH).
