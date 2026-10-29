const path = require('node:path');

module.exports = {
  appId: 'ao.machinefacturas.desktop',
  productName: 'Machine Facturas',
  asar: true,
  icon: path.resolve(__dirname, 'build', 'icon.ico'),
  directories: { app: path.resolve(__dirname, 'dist-electron', 'app'), output: path.resolve(__dirname, 'dist-desktop') },
  files: [
    '**/*',
    '!**/*.map',
    '!**/.env*',
    '!**/backups/**',
    '!**/tmp*/**',
  ],
  extraMetadata: { main: 'main.cjs' },
  npmRebuild: false,
  nodeGypRebuild: false,
  win: { target: [{ target: 'nsis', arch: ['x64'] }], artifactName: 'MachineFacturas-Setup.exe', signAndEditExecutable: false, requestedExecutionLevel: 'asInvoker', icon: path.resolve(__dirname, 'build', 'icon.ico') },
  nsis: {
    include: path.resolve(__dirname, 'build', 'installer.nsh'),
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
    installerIcon: path.resolve(__dirname, 'build', 'icon.ico'),
    uninstallerIcon: path.resolve(__dirname, 'build', 'icon.ico'),
  },
};
