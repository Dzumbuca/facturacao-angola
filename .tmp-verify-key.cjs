const crypto = require('crypto');
const fs = require('fs');

const raw = fs.readFileSync('backups/invoice-signing-private-key.pem', 'utf8').trim();
// Simulate the stored single-line env value (newlines escaped as literal \n):
const escaped = raw.replace(/\n/g, '\\n');
// Apply the app's transformation exactly as src/lib/crypto.ts does:
const value = escaped.replace(/\\n/g, '\n').trim();
const key = crypto.createPrivateKey(value);
console.log('PARSE OK:', key.asymmetricKeyType, '| bits:', key.asymmetricKeyDetails?.modulusLength);

// Sign like invoice-service.ts does:
const sign = crypto.createSign('SHA256');
sign.update('teste-de-assinatura');
const signature = sign.sign(key, 'base64');
const shortHash = `${signature[0]}${signature[10]}${signature[20]}${signature[30]}`;
console.log('SIGN OK | assinatura base64:', signature.length, 'chars | codigo de controlo AGT:', shortHash);

// Confirm the .env value also parses (what dev will use):
const envLine = fs.readFileSync('.env', 'utf8').split(/\r?\n/).find(l => l.startsWith('PRIVATE_KEY='));
const envValue = envLine.slice('PRIVATE_KEY='.length).replace(/^"|"$/g, '').replace(/\\n/g, '\n');
crypto.createPrivateKey(envValue);
console.log('ENV LOCAL OK');
