# WMS_E2E_DOCKER_INCIDENT_INVESTIGATION_2026-11-07
READ-ONLY investigação (proibidas operações destrutivas/recuperação). Sem segredos.

## Objetivo
Investigar incidente reportado: `machine-stock-test-pg` / volume `machine_stock_test_data` aparentemente desaparecido após `docker compose -f docker-compose.wms-e2e-disposable.yml up -d` (sem `-p`).

## Evidências recolhidas
### Containers (todos)
- `machine-wms-e2e-disposable` (2af4c2376d9a) Up (healthy) 00:05:04Z 2026-11-07, porta `0.0.0.0:5441->5432`, imagem postgres:17, projeto Compose `facturacao-angola` (labels), monta apenas volume exclusivo `machine-wms-e2e-disposable-data`.
- `erp-postgres` (d89f1ecdf4d1) Up 2 days, `0.0.0.0:5433->5432`, postgres:17, projeto Compose `facturacao-angola`.
- Outros containers: `mf_rls_baseline_lab_5440`, `machine-wms-staging`, vários `Exited` (kyc/n8n/waha/machinetrocas etc). **Nenhum container com nome `machine-stock-test-pg` encontrado** em `docker ps -a` (todos os estados) nem via filtro por nome/label/mount.

### Volumes
- Existe volume `facturacao-angola_machine_stock_test_data` (local, created 2026-10-31T20:03:03Z) com labels `com.docker.compose.project=facturacao-angola`, `com.docker.compose.volume=machine_stock_test_data`. **Não existe volume chamado `machine_stock_test_data`** (sem prefixo projeto).  
- Nenhum container (qualquer estado) monta `facturacao-angola_machine_stock_test_data`.  
- Existe volume exclusivo `machine-wms-e2e-disposable-data` montado apenas por `machine-wms-e2e-disposable`.

### Eventos Docker
- Janela ~10:04:30–10:05:30 mostra healthchecks/exec do `machine-wms-e2e-disposable` (pg_isready/psql) mas **sem eventos `destroy/create/start/stop/rename` claros para `machine-stock-test-pg` capturados** nesse filtro/time window com o formato utilizado (pode não ter sido emitido ou janela insuficiente).
- `docker events` por tipo container com formatação simples não devolveu ações do container afetado no intervalo consultado.

## Sequência provável
1. A partir do diretório `C:\Users\Administrador\Desktop\facturacao-angola` (projeto `facturacao-angola`) foi executado `docker compose -f docker-compose.wms-e2e-disposable.yml up -d` **sem `-p`**.
2. Docker Compose interpretou o `docker-compose.wms-e2e-disposable.yml` no contexto do projeto `facturacao-angola`, identificou serviço `postgres` e aplicou lógica de recriação/reconciliação; o aviso reportou `machine-stock-test-pg` "Recreate/Recreated". 
3. Com o container `machine-stock-test-pg` (definido noutro compose/estado do mesmo projeto `facturacao-angola`) não listado atualmente e sem container a montá-lo, é plausível que tenha sido **removido/desanexado** pela reconciliação do Compose sem `-p`. 
4. O volume com prefixo `facturacao-angola_machine_stock_test_data` **ainda existe** (não removido), mas não está montado por nenhum container no momento.

## Estado atual
- **Container afetado `machine-stock-test-pg`:** **Não encontrado** em `docker ps -a` / inspect / mount search. Presumivelmente removido ou nunca existente nesse inventário.
- **Volume `machine_stock_test_data` / `facturacao-angola_machine_stock_test_data`:** **Volume existe** (labels projeto `facturacao-angola`, criado 2026-10-31T20:03:03Z). **Sem container montado** atualmente. Sem operações de remoção/montagem/alteração executadas nesta investigação.
- **Alvo autorizado:** `machine-wms-e2e-disposable` UP/healthy em 5441, volume exclusivo montado, BD `wms_e2e_disposable` acessível e vazia no estado atual.

## Possibilidade de recuperação
**Possível, mas não garantida e não realizada nesta investigação.** O volume `facturacao-angola_machine_stock_test_data` ainda existe fisicamente. Poderia, em teoria, ser montado por um novo container com a mesma configuração (`POSTGRES_DB`/usuário/versão compatíveis) para inspecionar os dados, mas:
- sem nome exato do DB original, configurações exatas e verificação de integridade;
- há risco de inconsistência se dados forem acedidos enquanto processo não conhecido os modifica;
- **proibido** nesta investigação (montar/alterar volume/recuperação).

## Risco de perda de dados
**Não determinável apenas com estes READ-ONLY checks.** O container desapareceu do inventário, mas o volume com prefixo do projeto ainda existe e não está montado por nenhum container agora. Se não houver backup externo, **há risco de dados ficarem inacessíveis** até que seja montado/testado por alguém com autorização explícita. Não há evidência de `docker volume rm` nesta janela.

## Recomendação de remediação
1. **Não agir agora.** Aguardar autorização posterior antes de qualquer operação de recuperação/montagem/desanexação.
2. **Identificar configuração original** (compose/ambiente) que criava `machine-stock-test-pg` (`docker-compose.test.yml` mostra definição, mas container não aparece; confirmar qual compose o gerava).
3. **Só com autorização explícita:** inspecionar dados montando volume noutro container **read-only**/temporário (sem `up/down` forçados sobre outros stacks), documentar schemas/DBs existentes nesse volume, decidir se manter/recuperar/testar. **Nunca** remover o volume.
4. **Usar sempre `-p <project>`** em futuros `docker compose` para evitar reconciliação multi-stack no mesmo diretório/projeto.
5. **Manter `machine-wms-e2e-disposable` isolado em 5441 (já feito).**

**Sem provas de destruição. Volume persiste; container ausente. Risco de inacessibilidade/incerteza, não perda confirmada.**
