# Perfil da Empresa nas Facturas — Plano de Implementação

> **Para agentes executores:** obrigatório seguir o sub-skill `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Os passos usam caixas de verificação para acompanhar o trabalho.

**Objectivo:** Permitir editar um perfil único da empresa e escolher se os seus dados e logótipo aparecem em cada nova factura, preservando o perfil usado em facturas emitidas.

**Arquitectura:** Estender o tenant e acrescentar uma tabela de versões imutáveis de logótipos; guardar um snapshot dos dados comerciais e a referência da imagem na factura. Criar uma página autenticada de dados da empresa e endpoints tenant-scoped. A emissão lê os dados do tenant pela sessão e o PDF usa apenas o snapshot guardado, conforme a escolha da factura.

**Tecnologias:** Next.js App Router do projecto, React, TypeScript, Prisma 5.22, PostgreSQL e PDFKit já instalados.

**Especificação:** `docs/superpowers/specs/2026-10-19-perfil-empresa-facturas-design.md`

## Restrições Globais

- Um perfil único por empresa; sem perfis alternativos.
- Campos não obrigatórios permanecem vazios até serem preenchidos.
- A factura continua a poder ser emitida com o perfil incompleto; o PDF omite dados vazios.
- Logótipo PNG/JPEG, máximo de 1 MB.
- A opção de inclusão começa activa em cada factura e pode ser desactivada.
- O endpoint e a emissão usam sempre o tenant autenticado; dados do navegador não substituem o perfil da empresa.
- Facturas guardam snapshot dos dados da empresa e referência à versão imutável do logótipo.
- Não adicionar dependências externas nem armazenamento externo.

## Focos de Revisão

- **Pedido sem sessão ou de outro tenant:** endpoints retornam 401 sem sessão e só leem/alteram o tenant da sessão. Rever nos handlers de perfil.
- **Logótipo de MIME falso, formato não suportado ou acima de 1 MB:** rejeitar antes de persistir. Rever na validação do upload.
- **Perfil parcialmente preenchido:** permitir emissão e omitir valores vazios no PDF. Rever no serializador e renderer do PDF.
- **Perfil desactivado na factura:** não incluir dados nem logótipo, mesmo que existam. Rever na preparação do snapshot no serviço de emissão.
- **Perfil/logótipo alterado depois da emissão:** snapshot e referência de versão da factura continuam a apontar para os valores antigos. Rever na persistência e hash da factura.

---

### Tarefa 1: Modelo do perfil, versões de logótipo e migração

**Ficheiros:**
- Modificar: `prisma/schema.prisma`
- Criar: `prisma/migrations/<timestamp>_company_invoice_profile/migration.sql`

**Interfaces:**
- `Tenant` mantém `name`, `nif`, `address`, `phone` e `email`; acrescenta `website`, `bankName`, `bankAccountName`, `iban`, `currentLogoId` e relação `currentLogo`.
- `CompanyLogo` guarda `id`, `tenantId`, `mimeType`, `content Bytes @db.ByteA`, `createdAt`; liga-se ao tenant e às facturas que a referenciam.
- `Invoice` acrescenta `includeCompanyProfile Boolean @default(false)` para preservar registos antigos, `companyProfileSnapshot Json?` e `companyLogoId String?` com relação à versão de logótipo usada. O formulário e o serviço definem explicitamente `true` em novas facturas.

- [ ] **Passo 1: Actualizar o schema Prisma** com os campos opcionais, relações nomeadas e índices tenant-scoped necessários, sem alterar valores de facturas existentes.
- [ ] **Passo 2: Criar migração SQL aditiva**: acrescentar os campos com os defaults definidos, criar a tabela de versões de logótipo, chaves estrangeiras e índices.
- [ ] **Passo 3: Validar o schema Prisma** com `node node_modules/prisma/build/index.js validate`.
- [ ] **Passo 4: Regenerar o Prisma Client** e rever os tipos resultantes usados pelas tarefas seguintes.

### Tarefa 2: API autenticada e validação do perfil

**Ficheiros:**
- Criar: `src/lib/company-profile-validation.ts`
- Criar: `src/app/api/company-profile/route.ts`

**Interfaces:**
- `validateCompanyProfileInput(input: unknown)` retorna `{ isValid: boolean; errors: string[]; value?: CompanyProfileInput }`.
- `GET /api/company-profile` retorna os dados editáveis e o logótipo actual para o tenant autenticado.
- `PUT /api/company-profile` recebe multipart/form-data com os campos de perfil, `logo` opcional e `removeLogo` opcional; retorna o perfil actualizado.

- [ ] **Passo 1: Implementar validação** dos comprimentos dos campos, tipos de formulário, imagem PNG/JPEG e limite de 1 MB.
- [ ] **Passo 2: Implementar GET** usando `auth()` e `getSessionTenantId`; buscar apenas o tenant da sessão.
- [ ] **Passo 3: Implementar PUT** usando transacção para criar uma versão de logótipo e trocar o logótipo actual com a actualização de campos, ou limpar a referência ao receber `removeLogo`.
- [ ] **Passo 4: Preservar versões referenciadas por facturas**; remover uma versão antiga apenas quando já não for actual nem usada por uma factura.
- [ ] **Passo 5: Rever os caminhos de erro** para que pedidos não autenticados, inválidos ou demasiado grandes não alterem o perfil.

### Tarefa 3: Página de dados da empresa e navegação

**Ficheiros:**
- Criar: `src/app/(dashboard)/empresa/page.tsx`
- Criar: `src/app/(dashboard)/empresa/company-profile-form.tsx`
- Modificar: `src/components/app-shell.tsx`

**Interfaces:**
- A página server-side carrega o tenant pela sessão e passa dados serializáveis ao formulário.
- O formulário recebe `initialProfile` e envia `PUT /api/company-profile` em `multipart/form-data`.

- [ ] **Passo 1: Criar página autenticada** com título, carregamento de perfil e estado sem tenant consistente com as páginas existentes.
- [ ] **Passo 2: Criar formulário** para nome, NIF, morada, telefone, email, website, banco, titular, IBAN e upload/remoção do logótipo; mostrar pré-visualização e estados de gravação/erro/sucesso.
- [ ] **Passo 3: Acrescentar “Dados da empresa”** à navegação lateral e móvel, com ícone e título activo.
- [ ] **Passo 4: Rever navegação e formulário** em larguras móveis e desktop, incluindo foco por teclado e erros de validação apresentados junto ao formulário.

### Tarefa 4: Snapshot por factura, hash e PDF

**Ficheiros:**
- Modificar: `src/app/(dashboard)/invoices/new/page.tsx`
- Modificar: `src/app/(dashboard)/invoices/new/invoice-form.tsx`
- Modificar: `src/app/api/invoices/generate-pdf/route.ts`
- Modificar: `src/lib/invoice-service.ts`
- Modificar: `src/lib/crypto.ts`
- Modificar: `src/lib/pdf-generator.ts`

**Interfaces:**
- Página da factura passa `hasCompanyProfile: boolean`; o formulário inclui `includeCompanyProfile` no pedido, activo por padrão.
- O serviço de emissão aceita `invoiceData.includeCompanyProfile`, obtém os campos e logótipo do tenant autenticado e cria `companyProfileSnapshot` com os campos preenchidos.
- O PDF recebe `companyProfileSnapshot` e bytes/MIME da versão de logótipo; não lê dados empresariais do pedido do browser.

- [ ] **Passo 1: Adicionar opção no formulário** com o rótulo “Incluir dados da empresa no PDF”, activa por padrão e desligável por factura.
- [ ] **Passo 2: Actualizar emissão** para, se activa, buscar tenant e logótipo pela sessão, filtrar campos vazios, persistir snapshot/referência e incluir os dados no hash; se desligada, gravar snapshot vazio e sem relação de logótipo.
- [ ] **Passo 3: Actualizar o PDF** para remover valores fictícios do emissor e imprimir os campos de texto preenchidos, bloco bancário e logótipo apenas se a factura incluir o perfil; omitir conteúdo de imagem inválido sem falhar a emissão.
- [ ] **Passo 4: Confirmar preservação histórica**: a geração da factura usa o snapshot e a versão seleccionada, mesmo que o perfil seja editado depois.

### Tarefa 5: Verificação de integração

**Ficheiros:** nenhum novo.

**Interfaces:** validar a integração entre perfil, emissão, hash e PDF contra a especificação.

- [ ] **Passo 1: Validar schema e migrações** com Prisma antes de regenerar o cliente.
- [ ] **Passo 2: Executar verificação de tipos** com `node node_modules/typescript/bin/tsc --noEmit`.
- [ ] **Passo 3: Rever as rotas e componentes no navegador** com perfil vazio, completo, inclusão desligada e vista móvel; não criar uma factura real durante a revisão.
- [ ] **Passo 4: Confirmar o limite de imagem, isolamento por tenant, omissão de campos vazios e preservação da imagem anterior em facturas já emitidas.**
