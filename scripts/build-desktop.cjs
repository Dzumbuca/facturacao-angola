const { build } = require('esbuild');
const { copyFile, mkdir, rm, cp, readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { getDesktopBuildConfig } = require('./desktop-build-config.cjs');

const root = path.resolve(__dirname, '..');
const electronOut = path.join(root, 'dist-electron');
const appOut = path.join(electronOut, 'app');
const offlineOut = path.join(root, 'desktop', 'offline-dist');
const { origin, publicKey } = getDesktopBuildConfig();

async function main() {
  await Promise.all([rm(electronOut, { recursive: true, force: true }), rm(offlineOut, { recursive: true, force: true })]);
  await Promise.all([mkdir(electronOut, { recursive: true }), mkdir(offlineOut, { recursive: true })]);
  await Promise.all([
    build({ entryPoints: [path.join(root, 'electron', 'main.ts')], outfile: path.join(electronOut, 'main.cjs'), bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['electron', 'sql.js'], minify: true, define: { __DESKTOP_ORIGIN__: JSON.stringify(origin), __OFFLINE_PUBLIC_KEY__: JSON.stringify(publicKey) } }),
    build({ entryPoints: [path.join(root, 'electron', 'preload.ts')], outfile: path.join(electronOut, 'preload.cjs'), bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['electron'], minify: true }),
    build({ entryPoints: [path.join(root, 'electron', 'recovery-test-main.ts')], outfile: path.join(electronOut, 'recovery-test-main.cjs'), bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['electron', 'sql.js'] }),
    build({ entryPoints: [path.join(root, 'desktop', 'offline', 'main.tsx')], outfile: path.join(offlineOut, 'offline.js'), bundle: true, platform: 'browser', target: 'chrome130', format: 'iife', minify: true, jsx: 'automatic', loader: { '.tsx': 'tsx' } }),
    copyFile(path.join(root, 'desktop', 'offline', 'index.html'), path.join(offlineOut, 'index.html')),
    copyFile(path.join(root, 'desktop', 'offline', 'offline.css'), path.join(offlineOut, 'offline.css')),
  ]);
  await mkdir(path.join(appOut, 'desktop', 'offline-dist'), { recursive: true });
  await mkdir(path.join(appOut, 'node_modules', 'sql.js', 'dist'), { recursive: true });
  await Promise.all([
    copyFile(path.join(electronOut, 'main.cjs'), path.join(appOut, 'main.cjs')),
    copyFile(path.join(electronOut, 'preload.cjs'), path.join(appOut, 'preload.cjs')),
    cp(offlineOut, path.join(appOut, 'desktop', 'offline-dist'), { recursive: true }),
    copyFile(path.join(root, 'node_modules', 'sql.js', 'package.json'), path.join(appOut, 'node_modules', 'sql.js', 'package.json')),
    copyFile(path.join(root, 'node_modules', 'sql.js', 'LICENSE'), path.join(appOut, 'node_modules', 'sql.js', 'LICENSE')),
    copyFile(path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.js'), path.join(appOut, 'node_modules', 'sql.js', 'dist', 'sql-wasm.js')),
    copyFile(path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'), path.join(appOut, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')),
  ]);
  const project = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  await writeFile(path.join(appOut, 'package.json'), JSON.stringify({ name: 'machine-facturas-desktop', version: project.version, productName: 'Machine Facturas', description: 'Aplicação desktop híbrida Machine Facturas', author: 'Machine Facturas', main: 'main.cjs', dependencies: { 'sql.js': project.dependencies['sql.js'] } }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
