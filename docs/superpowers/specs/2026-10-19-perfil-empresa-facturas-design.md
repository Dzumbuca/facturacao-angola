# Perfil da empresa nas facturas

## Intenção

Permitir que cada empresa mantenha os seus dados comerciais num único perfil e escolha se esse perfil aparece em cada factura emitida. Isto substitui os dados de exemplo actuais do PDF e evita voltar a preencher os dados da empresa em cada emissão.

## Objectivos

- Criar uma página autenticada **Dados da empresa** para consultar e editar o perfil da empresa associada à sessão.
- Reutilizar os campos de empresa existentes: nome, NIF, morada, telefone e email.
- Acrescentar logótipo, website e dados bancários: banco, titular da conta e IBAN.
- Permitir carregar um logótipo PNG ou JPEG, com validação de tipo e tamanho.
- Na emissão, disponibilizar uma opção para incluir ou omitir o perfil no PDF; a opção vem activa por padrão e pode ser alterada factura a factura.
- Quando incluído, imprimir no PDF apenas os dados guardados, sem os valores fictícios actuais.
- Manter os dados isolados por empresa e proteger as operações com a sessão autenticada.

## Fora de âmbito

- Vários perfis ou modelos de factura.
- Personalização de cores, fontes, posições ou modelos do PDF.
- Alteração retroactiva de facturas já emitidas.
- Armazenamento externo de ficheiros, como S3 ou Cloudinary.

## Fluxo proposto

1. O utilizador abre **Dados da empresa** na navegação da aplicação.
2. A página carrega o perfil da empresa da sessão e permite actualizar nome, NIF, morada, telefone, email, website, banco, titular, IBAN e logótipo.
3. Ao abrir **Emitir factura**, a opção **Incluir dados da empresa no PDF** vem activa. O utilizador pode desactivá-la nessa factura.
4. O servidor volta a carregar o perfil associado à sessão durante a emissão; não confia em dados de empresa enviados pelo navegador. A escolha de inclusão é validada e o PDF é criado com os dados desse perfil quando activa.

## Persistência e implementação

- Acrescentar os campos opcionais de website, dados bancários e logótipo ao `Tenant`, mantendo os campos comerciais já existentes.
- Guardar cada versão do logótipo numa tabela `CompanyLogo` do PostgreSQL como bytes e tipo MIME, limitada a 1 MB e aceite apenas em PNG/JPEG. O perfil da empresa aponta para o logótipo actual; cada factura incluída aponta para a versão usada, evitando copiar até 1 MB para cada factura e preservando o original.
- Criar endpoints autenticados e limitados ao tenant da sessão para ler e actualizar o perfil. Validar comprimentos, campos opcionais e imagem no servidor.
- Criar a página `/empresa` e acrescentar ligação na navegação desktop e móvel.
- Passar os dados públicos do perfil para o formulário de factura; enviar apenas a escolha de inclusão, não uma cópia confiável dos dados empresariais.
- Guardar na factura a opção `includeCompanyProfile`, um snapshot JSON dos campos de texto usados na emissão e a referência imutável ao logótipo usado, para que a representação histórica não mude se o perfil for editado mais tarde.
- Incluir a escolha, o snapshot e a versão do logótipo no hash fiscal antes de assinar. A factura continua a usar os campos de cliente, linhas, IVA, desconto e observações já existentes.
- Actualizar o PDF para desenhar o logótipo e imprimir somente os campos preenchidos. Dados bancários aparecem em bloco próprio quando existirem.
- Criar uma migração Prisma aditiva para os novos campos do tenant e da factura, e regenerar o Prisma Client.

## Regras e chamadas do construtor

- O perfil é único por empresa; não existem modelos alternativos.
- Os campos não obrigatórios ficam vazios até o utilizador os preencher.
- A emissão continua permitida se o perfil estiver incompleto; o PDF omite os campos vazios e apresenta apenas o que está preenchido.
- O logótipo deve ser validado quanto ao MIME e ao tamanho, e o PDF deve ignorá-lo com segurança se estiver ausente ou inválido.
- A opção de inclusão por factura vem activa por padrão, mas pode ser desactivada sem apagar nem alterar o perfil.
- O formulário e o serviço definem explicitamente `includeCompanyProfile = true` para novas facturas; o default de base de dados é falso para que registos antigos não aleguem ter snapshot de dados que nunca guardaram.
- Um snapshot da factura guarda os dados exactos usados para aquele PDF; alterar o perfil só afecta facturas futuras.
- O endpoint de actualização deve rejeitar campos que não pertencem ao tenant, e a emissão deve obter o tenant apenas pela sessão.

## Critérios de aceitação

- O utilizador autenticado consegue editar e voltar a abrir os dados da sua empresa.
- Nenhum utilizador consegue consultar ou alterar o perfil de outra empresa.
- A emissão permite incluir ou omitir o perfil sem expor dados empresariais falsificados pelo cliente.
- O PDF inclui logo, dados comerciais e dados bancários preenchidos quando a opção está activa, e omite-os quando está desligada.
- Facturas emitidas preservam o snapshot dos dados apresentados, mesmo após futuras edições do perfil.
- A migração preserva os registos existentes e dá valores padrão compatíveis às facturas antigas.
