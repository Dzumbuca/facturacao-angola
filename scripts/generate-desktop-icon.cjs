const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const logo = path.join(root, 'public', 'logo.png');
const outDir = path.join(root, 'build');
const out = path.join(outDir, 'icon.ico');

if (!fs.existsSync(logo)) {
  console.error('Official logo not found:', logo);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const python = process.platform === 'win32' ? 'python' : 'python3';
const code = `from PIL import Image
img = Image.open(r'''${logo.replace(/\\/g, '\\\\')}''')
img.save(r'''${out.replace(/\\/g, '\\\\')}''', format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('Generated', r'''${out.replace(/\\/g, '\\\\')}''')`;

execFileSync(python, ['-c', code], { stdio: 'inherit' });
