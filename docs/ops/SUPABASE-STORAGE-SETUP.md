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
2. Aplicar as três políticas/owners listadas abaixo via SQL no SQL Editor (apenas o service role acede; o bucket pode ser privado se manteres **Public: OFF** e usares signed URLs):
   ```sql
   -- O acesso é exclusivo do service_role; não crear policies públicas.
   ```
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
