const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1ZmEzYjEzOS05Y2Q0LTQyNDctOTlmMy0yODg2ZTQxNzViMzUiLCJlbWFpbCI6InRlc3QtcHJldmlldy05NTk2MWZiNEBtYWNoaW5lZmF0dXJhcy50ZXN0IiwidGVuYW50SWQiOiIxYzI0MzQxNi0wNTRjLTQxMWItOGNmMi0xMWNmYjQzYzQ5MmYiLCJzZXNzaW9uVmVyc2lvbiI6MCwiaWF0IjoxNzk1NTI5NjAyLCJleHAiOjE3OTgxMjE2MDJ9.w_oaUTwaBjLbOR8zRi69xxW4JvpPoEFRUftUb6Ixrwk';

async function test() {
  const url = 'https://facturacao-angola-git-release-a18-preview-dzumbucas-projects.vercel.app';
  
  // Test with both cookie names
  const cookieNames = ['next-auth.session-token', '__Secure-next-auth.session-token', 'next-auth.callback-url'];
  
  for (const cookieName of cookieNames) {
    console.log(`\n=== Testing with cookie: ${cookieName} ===`);
    const response = await fetch(url + '/api/auth/session', {
      method: 'GET',
      headers: {
        'Cookie': `${cookieName}=${token}`,
      },
    });
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
  }
}

test().catch(console.error);