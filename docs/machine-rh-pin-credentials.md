# Machine RH — credenciais de PIN do ponto

## Visão geral

O PIN do ponto (6 dígitos) é a credencial de identificação do quiosque de assiduidade (`/rh/ponto`). Nunca fica em texto plano nem nunca é reexibido na interface.

## Armazenamento

- `pinHash`: bcrypt (custo 10) do PIN — usado pelo quiosque para validar com `bcrypt.compare`.
- `pinLookup`: HMAC-SHA256(PIN, `PIN_PEPPER`) — determinístico, permite detectar duplicados dentro do tenant em O(log n) sem expor o PIN nem permitir força bruta trivial fora do sistema.
- `pinChangedAt`: data/hora da última alteração da credencial.

## Regras de segurança

1. `PIN_PEPPER` NUNCA é exposto no front-end, em respostas HTTP, logs ou storage.
2. Em produção, a ausência de `PIN_PEPPER` impede a criação/edição de PINs (fail-fast).
3. `PIN_PEPPER` não pode ser partilhado entre ambientes.
4. O pepper apenas serve como lookup; o bcrypt é quem autentica.

## Rotação de `PIN_PEPPER`

**Rodar o pepper invalida TODOS os `pinLookup` existentes.** Os PINs continuam a funcionar no quiosque (bcrypt não depende do pepper), mas:

- A detecção de duplicados fica cega para todos os PINs legados (lookup NULL ou inválido);
- Criadores/editar PIN falham se a unicidade não puder ser garantida para o legado sem reset.

### Procedimento de rotação

1. Gerar novo pepper: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Definir `PIN_PEPPER` no ambiente e reiniciar a aplicação.
3. **Obrigatório**: forçar redefinição de PIN de todos os funcionários (definição individual no perfil ou operação em lote da administração).
4. Verificar que todas as colunas `pinLookup` estão preenchidas antes de voltar a um modo normal.
5. Nunca reutilizar um pepper antigo.

### Procedimento de recuperação

Se o pepper for perdido sem back-up:

1. Todos os funcionários têm de redefinir o PIN (edição individual ou via administração).
2. Os quiosques continuam a autenticar via bcrypt até ao reset (o pepper só serve para unicidade administrativa, não para o quiosque).
3. Não existe forma de recuperar o lookup sem o pepper original.

## Concorrência e unicidade

- O índice único composto `(tenantId, pinLookup)` (ver migração `20261117000000_rh_pin_credentials`)
  impede dois funcionários do mesmo tenant com o mesmo PIN mesmo em escritas simultâneas.
- Violação de unicidade traduz-se sempre em HTTP 409 e mensagem «Este PIN já está em uso.» —
  sem revelar se a colisão foi com credencial nova ou legada.
- PINs legados (pinHash sem pinLookup) são comparados via bcrypt no registo/edição para impedir colisões com credenciais antigas.

## Dados legados

Funcionários existentes com `pinHash` e `pinLookup = NULL`:

- Continuam a autenticar no quiosque (bcrypt);
- São detectados nas novas verificações por comparação bcrypt;
- Não são obrigados a redefinir o PIN, mas a administração é encorajada a pedir reset na próxima visita ao perfil.

## O que NUNCA fazer

- Não expor `pinLookup` em APIs ou logs (não revela o PIN, mas facilita ataques de dicionário com o pepper).
- Não usar `NEXTAUTH_SECRET` como substituto.
- Não guardar o PIN em texto simples.
- Não reduzir o número de dígitos sem alterar toda a validação.
