const { spawn } = require('node:child_process');
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const timeoutMs = 20_000;
const defaultExecutable = path.resolve(__dirname, '..', 'dist-desktop', 'win-unpacked', 'Machine Facturas.exe');
const executable = path.resolve(process.argv[2] || defaultExecutable);
const tempRoot = path.join(os.tmpdir(), 'machine-facturas-electron-smoke-');

const smokeMain = String.raw`const { app, BrowserWindow } = require('electron');
let window;
app.whenReady().then(async () => {
  console.log('SMOKE_MAIN_READY electron=' + process.versions.electron + ' chrome=' + process.versions.chrome);
  window = new BrowserWindow({
    width: 500,
    height: 320,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.once('did-fail-load', (_event, code, description, url) => {
    console.error('SMOKE_RENDERER_FAILED', JSON.stringify({ code, description, url }));
    app.exit(2);
  });
  await window.loadURL('data:text/html,<title>machine-facturas-smoke-ready</title><main>Electron renderer ready</main>');
  const title = await window.webContents.executeJavaScript('document.title');
  if (title !== 'machine-facturas-smoke-ready') throw new Error('Unexpected renderer title: ' + title);
  console.log('SMOKE_RENDERER_READY title=' + title);
  app.quit();
}).catch((error) => {
  console.error('SMOKE_MAIN_FAILED', error && error.stack ? error.stack : String(error));
  app.exit(2);
});
`;

function collect(stream) {
  let output = '';
  stream.on('data', (chunk) => { output += chunk.toString(); });
  return () => output;
}

async function main() {
  const root = await mkdtemp(tempRoot);
  const appRoot = path.join(root, 'app');
  await mkdir(appRoot, { recursive: true });
  await writeFile(path.join(appRoot, 'package.json'), JSON.stringify({ name: 'machine-facturas-electron-smoke', version: '1.0.0', main: 'main.cjs' }));
  await writeFile(path.join(appRoot, 'main.cjs'), smokeMain);

  let stdout = '';
  let stderr = '';
  let processResult;
  const child = spawn(executable, [appRoot, `--user-data-dir=${path.join(root, 'profile')}`, '--enable-logging=stderr', '--v=1'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false });
  const readStdout = collect(child.stdout);
  const readStderr = collect(child.stderr);
  const timeout = setTimeout(() => child.kill(), timeoutMs);
  try {
    processResult = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
  } catch (error) {
    stderr += `SPAWN_ERROR ${error.message}\n`;
    processResult = { code: null, signal: null };
  } finally {
    clearTimeout(timeout);
    stdout += readStdout();
    stderr += readStderr();
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
  }

  const markers = {
    mainReady: stdout.includes('SMOKE_MAIN_READY'),
    rendererReady: stdout.includes('SMOKE_RENDERER_READY'),
  };
  const result = {
    executable,
    timeoutMs,
    exitCode: processResult.code,
    exitCodeHex: Number.isInteger(processResult.code) ? `0x${(processResult.code >>> 0).toString(16)}` : null,
    signal: processResult.signal,
    markers,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    sandbox: 'enabled',
  };
  console.log(JSON.stringify(result, null, 2));
  if (processResult.code !== 0 || !markers.mainReady || !markers.rendererReady) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
