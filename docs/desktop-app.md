# Aplicação desktop Windows

A aplicação Electron abre a versão online em `https://machinefaturas.shop`. Sem ligação ao site, pode abrir a cópia local autorizada para consultar o perfil/catálogo e guardar apenas rascunhos de factura. A emissão fiscal continua a exigir sincronização e validação no servidor.

## Desenvolvimento e empacotamento

- `npm run desktop:build` cria `dist-electron/` e `desktop/offline-dist/`.
- `npm run desktop:dev` compila e abre a aplicação Electron contra o site configurado.
- `npm run desktop:test` executa os testes do desktop.
- `npm run desktop:smoke` lança uma aplicação Electron mínima com sandbox ligado, verifica `main` e renderer e imprime código de saída/logs. Pode receber o executável como argumento: `npm run desktop:smoke -- "C:\\caminho\\Machine Facturas.exe"`.
- `npm run desktop:dist` cria o instalador NSIS x64 em `dist-desktop/MachineFacturas-Setup.exe`.

O smoke test não autentica nem substitui a validação funcional da aplicação. Execute-o numa instalação limpa de Windows suportado antes de distribuir uma versão; a falha nativa de Electron em builds Windows 26300 precisa de validação upstream/num host compatível e não deve ser contornada removendo o sandbox.

O build pode receber `DESKTOP_APP_ORIGIN` com uma origem HTTPS e `DESKTOP_OFFLINE_GRANT_PUBLIC_KEY` com a chave **pública** Ed25519 em PEM. Sem chave pública, a aplicação continua disponível online, mas a cópia offline não é activada.

O endpoint de bootstrap só emite a autorização depois de validar a sessão e a empresa activa. Para activar o modo offline no servidor, configure `DESKTOP_OFFLINE_GRANT_PRIVATE_KEY` com a chave privada Ed25519 correspondente. A chave privada permanece exclusivamente no ambiente do servidor; nunca a passe ao build desktop. Não existe migração de base de dados.

O download público só aparece quando `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` contém um URL HTTPS real. Configure-o apenas depois de publicar e validar um instalador; o repositório não define um URL de download fictício.
