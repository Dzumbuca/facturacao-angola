const url = 'https://facturacao-angola-nl2f4gikn-dzumbucas-projects.vercel.app';

async function test() {
  console.log('=== GET /login (inspect form) ===');
  const r1 = await fetch(url + '/login', { method: 'GET', credentials: 'include' });
  const t1 = await r1.text();
  
  // Extract form action
  const formMatch = t1.match(/<form[^>]*action="([^"]*)"[^>]*>/i);
  console.log('Form action:', formMatch ? formMatch[1] : 'NOT FOUND');
  
  // Extract csrf token
  const csrfMatch = t1.match(/name="csrfToken"[^>]*value="([^"]*)"/i);
  console.log('CSRF Token in form:', csrfMatch ? csrfMatch[1] : 'NOT FOUND');
  
  // Check for any form inputs
  const inputMatches = t1.match(/<input[^>]*name="([^"]*)"[^>]*>/gi);
  console.log('Form inputs:', inputMatches);
  
  // Also check for the actual form HTML
  const formHtml = t1.match(/<form[^>]*>[\s\S]*?<\/form>/i);
  console.log('Form HTML:', formHtml ? formHtml[0].substring(0, 500) : 'NOT FOUND');
}

test().catch(console.error);