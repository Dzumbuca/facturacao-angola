const url = (process.env.PREVIEW_URL || '').replace(/\/$/, '');
const email = process.env.PREVIEW_AUTH_EMAIL;
const password = process.env.PREVIEW_AUTH_PASSWORD;

function cookiePairs(response) {
  return (response.headers.getSetCookie?.() || [])
    .map((value) => value.split(';', 1)[0])
    .filter(Boolean);
}

async function test() {
  if (!url || !email || !password) {
    throw new Error('Define PREVIEW_URL, PREVIEW_AUTH_EMAIL e PREVIEW_AUTH_PASSWORD no ambiente.');
  }

  const headers = process.env.VERCEL_BYPASS_TOKEN
    ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS_TOKEN }
    : {};
  const csrfResponse = await fetch(`${url}/api/auth/csrf`, { headers });
  const csrfData = await csrfResponse.json();
  const csrfCookies = cookiePairs(csrfResponse);
  if (!csrfResponse.ok || typeof csrfData.csrfToken !== 'string' || !csrfData.csrfToken) {
    throw new Error(`Auth.js CSRF endpoint failed (${csrfResponse.status}).`);
  }

  const signin = await fetch(`${url}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
      ...headers,
      Cookie: csrfCookies.join('; '),
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken: csrfData.csrfToken,
      callbackUrl: `${url}/`,
    }),
  });
  const signinData = await signin.json();
  const sessionCookies = cookiePairs(signin);
  const cookies = [...new Map([...csrfCookies, ...sessionCookies].map((pair) => [pair.split('=', 1)[0], pair])).values()];
  const sessionResponse = await fetch(`${url}/api/auth/session`, {
    headers: { ...headers, Cookie: cookies.join('; ') },
  });
  const session = await sessionResponse.json();

  console.log(JSON.stringify({
    csrfStatus: csrfResponse.status,
    callbackStatus: signin.status,
    callbackUrl: signinData.url,
    sessionStatus: sessionResponse.status,
    authenticated: Boolean(session.user?.id),
    hasTenant: Boolean(session.user?.tenantId),
  }, null, 2));

  if (!signin.ok || !sessionResponse.ok || !session.user?.id) {
    throw new Error('Preview credentials sign-in did not produce a valid Auth.js session.');
  }
}

test().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
