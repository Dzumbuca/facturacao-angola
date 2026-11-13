# Distribuição desktop: compatibilidade e escolha

## Evidência

- Este computador executa Windows build `26300.9818`. O Electron `45.1.0` termina com `0x80000003` antes de inicializar `app.whenReady`; o mesmo ocorre numa aplicação mínima e no executável extraído do ZIP oficial. O smoke test com `sandbox: true` confirma que main e renderer não ficam prontos.
- A falha corresponde ao problema aberto no Electron para Windows 11 26H2/build 26300: `STATUS_BREAKPOINT` no arranque e stack de V8 (`OptimizingCompileTaskExecutor`): https://github.com/electron/electron/issues/54614. As opções de diagnóstico não corrigiram a falha. Desactivar o sandbox não é aceitável.
- Há WebView2 instalado (`156.0.4314.50`), mas não há `rustc`, `cargo`, `cl.exe`, Visual Studio Build Tools nem diretório Cargo. A documentação Tauri para Windows requer Rust e dependências C++/MSVC para gerar o instalador. Tauri usa o WebView2 do sistema, pelo que é uma alternativa plausível, mas não foi possível compilar ou testar uma janela Tauri neste host.

## Porque não migrar nesta alteração

Tauri não é uma troca de executável sem alterações ao produto. O site carregado remotamente usa a sessão autenticada e `fetch` same-origin; no modo offline, o processo Electron fornece IPC estrito, `safeStorage`, armazenamento SQLite particionado por utilizador/empresa e sincronização da fila com a API. Uma migração teria de reconstruir e testar essas fronteiras em Rust/WebView2, incluindo autorização remota de comandos Tauri e compatibilidade/migração das chaves locais. Comprometer esse caminho sem uma toolchain nem teste funcional introduziria mais risco de autenticação, dados locais e isolamento empresarial do que manter temporariamente o runtime actual.

## Decisão e mitigação

Manter Electron com sandbox e bloquear a instalação apenas no build `26300`, conhecido por falhar antes da aplicação arrancar. Em builds diferentes, o instalador continua a oferecer a mesma aplicação, site e recursos offline. Este bloqueio não corrige a falha do Electron; evita instalar uma versão que não inicia nesse Windows. Remover o bloqueio exige testar um Electron actualizado ou um Tauri real no build afectado, com janela e testes funcionais.

## Validação pendente

O teste externo indispensável é executar o instalador e `npm run desktop:smoke` num Windows compatível com o runtime e, para retirar o bloqueio, numa máquina `26300.x` após uma actualização de runtime. A compilação do instalador nesta máquina valida o script NSIS, mas não prova que o Electron abre neste build.
