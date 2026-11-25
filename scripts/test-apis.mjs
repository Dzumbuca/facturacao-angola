const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1ZmEzYjEzOS05Y2Q0LTQyNDctOTlmMy0yODg2ZTQxNzViMzUiLCJlbWFpbCI6InRlc3QtcHJldmlldy05NTk2MWZiNEBtYWNoaW5lZmF0dXJhcy50ZXN0IiwidGVuYW50SWQiOiIxYzI0MzQxNi0wNTRjLTQxMWItOGNmMi0xMWNmYjQzYzQ5MmYiLCJzZXNzaW9uVmVyc2lvbiI6MCwiaWF0IjoxNzk1NTI5NjAyLCJleHAiOjE3OTgxMjE2MDJ9.w_oaUTwaBjLbOR8zRi69xxW4JvpPoEFRUftUb6Ixrwk';

async function test() {
  const url = 'https://facturacao-angola-git-release-a18-preview-dzumbucas-projects.vercel.app';
  
  // Test client creation
  console.log('=== Testing client creation ===');
  const clientResponse = await fetch(url + '/api/customers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`,
    },
    body: JSON.stringify({
      name: 'Test Client',
      email: 'client@test.com',
      phone: '+244 900 000 000',
      address: 'Test Address',
      nif: '123456789',
    })
  });
  console.log('Status:', clientResponse.status);
  const clientText = await clientResponse.text();
  console.log('Response:', clientText.substring(0, 500));
  
  // Test product creation
  console.log('\n=== Testing product creation ===');
  const productResponse = await fetch(url + '/api/produtos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`,
    },
    body: JSON.stringify({
      name: 'Test Product',
      price: 1000,
      unit: 'UN',
      taxRate: 14,
      description: 'Test product description',
    })
  });
  console.log('Status:', productResponse.status);
  const productText = await productResponse.text();
  console.log('Response:', productText.substring(0, 500));
}

test().catch(console.error);