export const isAdminPagePath = (pathname: string) =>
  pathname === '/admin' || pathname.startsWith('/admin/');

export const isProtectedPagePath = (pathname: string) =>
  pathname === '/' ||
  pathname === '/documentos' || pathname.startsWith('/documentos/') ||
  pathname === '/pagamento' ||
  pathname.startsWith('/reports/') || pathname === '/reports' ||
  pathname === '/produtos' || pathname.startsWith('/produtos/') ||
  pathname === '/empresa' || pathname.startsWith('/empresa/') ||
  pathname.startsWith('/customers/') || pathname === '/customers' ||
  pathname.startsWith('/invoices/') || pathname === '/invoices' ||
  pathname.startsWith('/products/') || pathname === '/products';
