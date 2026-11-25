const url = 'https://facturacao-angola-friup0sdf-dzumbucas-projects.vercel.app';

async function test() {
  // Get CSRF token using vercel curl bypass
  const csrfResponse = await fetch(url + '/api/auth/csrf', {
    method: 'GET',
    headers: {
      'x-vercel-protection-bypass': process.env.VERCEL_BYPASS_TOKEN || ''
    }
  });
  const csrfData = await csrfResponse.json();
  console.log('CSRF:', csrfData.csrfToken);
  
  // Try signin with form data
  const signin = await fetch(url + '/api/auth/signin/credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-vercel-protection-bypass': process.env.VERCEL_BYPASS_TOKEN || ''
    },
    body: 'email=test-preview-95961fb4@machinefaturas.test&password=8bNIuDPnsRIX7VUbA1!&csrfToken=' + csrfData.csrfToken
  });
  console.log('Signin status:', signin.status);
  const text = await signin.text();
  console.log('Signin body:', text.substring(0, 2000));
}

test().catch(console.error);