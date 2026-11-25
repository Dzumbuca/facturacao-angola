import { EncryptJWT } from 'jose';

const secretB64 = '1ozH9xIpVVBObr/B5k1Ju8AvCZNTbxQ+wzPkbIxW49c=';
const secret = new Uint8Array(atob(secretB64).split('').map(c => c.charCodeAt(0)));

const payload = {
  sub: '5fa3b139-9cd4-4247-99f3-2886e4175b35',
  email: 'test-preview-95961fb4@machinefaturas.test',
  tenantId: '1c243416-054c-411b-8cf2-11cfb43c492f',
  sessionVersion: 0,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
};

const token = await new EncryptJWT(payload)
  .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
  .setIssuedAt()
  .setExpirationTime('30d')
  .encrypt(secret);

console.log('Token (encrypted):', token);