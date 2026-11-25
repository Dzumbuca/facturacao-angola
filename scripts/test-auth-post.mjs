const url = 'https://facturacao-angola-nl2f4gikn-dzumbucas-projects.vercel.app';

async function test() {
  const actions = ['signin', 'signout', 'callback', 'providers', 'session', 'csrf'];
  
  for (const action of actions) {
    console.log('\n=== POST /api/auth/' + action + ' ===');
    const r = await fetch(url + '/api/auth/' + action, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    console.log('Status:', r.status);
    const t = await r.text();
    console.log('Body:', t.substring(0, 200));
  }
}

test().catch(console.error);