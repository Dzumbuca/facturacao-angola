const { createPublicKey } = require('node:crypto');

function getDesktopBuildConfig(environment = process.env) {
  const originValue = environment.DESKTOP_APP_ORIGIN || 'https://machinefaturas.shop';
  const origin = new URL(originValue);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('DESKTOP_APP_ORIGIN must be a clean HTTPS origin');
  }

  const configuredKey = environment.DESKTOP_OFFLINE_GRANT_PUBLIC_KEY || '';
  let publicKey = '';
  if (configuredKey) {
    if (/PRIVATE KEY/i.test(configuredKey)) throw new Error('Only a public Ed25519 key can be bundled in the desktop app');
    const parsed = createPublicKey(configuredKey.replace(/\\n/g, '\n'));
    if (parsed.type !== 'public' || parsed.asymmetricKeyType !== 'ed25519') {
      throw new Error('Desktop offline verification key must be a public Ed25519 key');
    }
    publicKey = parsed.export({ type: 'spki', format: 'pem' }).toString();
  }
  return { origin: origin.origin, publicKey };
}

module.exports = { getDesktopBuildConfig };
