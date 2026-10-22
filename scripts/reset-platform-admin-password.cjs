const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { randomBytes } = require('node:crypto');

const USER_ID = '967b0614-f03c-47ad-aada-403b9a1dc79c';

function readHidden(label) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('Run this script in an interactive terminal.'));
      return;
    }

    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let value = '';
    const finish = (error) => {
      process.stdin.removeListener('data', onData);
      process.stdin.setRawMode(false);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (buffer) => {
      for (const character of buffer.toString('utf8')) {
        if (character === '\u0003') return finish(new Error('Cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ' && character !== '\u007f') value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  if (process.argv.includes('--verify-auth')) {
    const candidate = await readHidden('Digite a palavra-passe que está a usar (entrada oculta): ');
    const baseUrl = 'http://localhost:3002';
    const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
    if (!csrfResponse.ok) throw new Error(`CSRF endpoint returned HTTP ${csrfResponse.status}.`);
    const csrf = await csrfResponse.json();
    const cookies = typeof csrfResponse.headers.getSetCookie === 'function'
      ? csrfResponse.headers.getSetCookie().map((cookie) => cookie.split(';', 1)[0]).join('; ')
      : (csrfResponse.headers.get('set-cookie') ?? '').split(';', 1)[0];
    const body = new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email: 'joaquimzumbuca@gmail.com',
      password: candidate,
      callbackUrl: `${baseUrl}/`,
    });
    const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: cookies,
        'x-auth-return-redirect': '1',
      },
      body,
      redirect: 'manual',
    });
    const result = await response.json().catch(() => ({}));
    const returnedUrl = typeof result.url === 'string' ? result.url : null;
    const error = returnedUrl ? new URL(returnedUrl).searchParams.get('error') : null;
    const path = returnedUrl ? new URL(returnedUrl).pathname : null;
    process.stdout.write(`${JSON.stringify({ httpStatus: response.status, authError: error, returnedPath: path, hasSessionCookie: /authjs\.session-token|next-auth\.session-token/i.test(typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie().join(';') : response.headers.get('set-cookie') ?? '') })}\n`);
    return;
  }

  const generated = process.argv.includes('--generate');
  let password;
  if (generated) {
    password = randomBytes(18).toString('base64url');
  } else {
    password = await readHidden('Nova palavra-passe (mínimo 8 caracteres; entrada oculta): ');
    const confirmation = await readHidden('Repita a nova palavra-passe: ');
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72 || password !== confirmation) {
      throw new Error('Confirmação inválida ou palavra-passe fora dos limites. Nenhuma alteração feita.');
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const generatedPasswordForDisplay = generated ? password : null;
  password = '';
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: USER_ID },
        select: { status: true, platformRole: true },
      });
      if (!user || user.status !== 'ACTIVE' || user.platformRole !== 'ADMIN') {
        throw new Error('A conta alvo já não está activa como ADMIN. Nenhuma alteração feita.');
      }

      await tx.user.update({ where: { id: USER_ID }, data: { password: passwordHash } });
      await tx.adminAuditLog.create({
        data: {
          actorType: 'BOOTSTRAP',
          action: 'ADMIN_PASSWORD_RESET',
          resourceType: 'USER',
          resourceId: USER_ID,
          reason: 'Redefinição autorizada pelo titular através do terminal local.',
          metadata: { source: generated ? 'user-authorized-generated-temp-password' : 'user-authorized-local-terminal' },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    process.stdout.write(generated
      ? `Palavra-passe temporária (copie-a agora): ${generatedPasswordForDisplay}\n`
      : 'Palavra-passe redefinida e operação auditada.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
