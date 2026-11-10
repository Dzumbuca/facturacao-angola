import { describe, it, expect } from 'vitest';
import { visibleNavGroups, type NavGroup } from './navigation';

const groups: NavGroup[] = [
  { title: 'Operações', links: [
    { href: '/invoices', label: 'Facturas', icon: 'file' },
    { href: '/produtos', label: 'Produtos', icon: 'box' },
    { href: '/warehouses', label: 'Armazéns', icon: 'building' },
  ] },
  { title: 'Armazém', links: [
    { href: '/stock', label: 'Stock', icon: 'layers' },
  ] },
];

describe('visibleNavGroups', () => {
  it('sem WMS esconde armazém/stock mas mantém produtos', () => {
    const result = visibleNavGroups(groups, false);
    expect(result.map((g) => g.title)).toEqual(['Operações']);
    expect(result[0].links.map((l) => l.href)).toEqual(['/invoices', '/produtos']);
  });

  it('com WMS mantém todos os links', () => {
    const result = visibleNavGroups(groups, true);
    expect(result.flatMap((g) => g.links.map((l) => l.href))).toContain('/warehouses');
    expect(result.flatMap((g) => g.links.map((l) => l.href))).toContain('/stock');
  });

  it('remove grupos que ficam vazios', () => {
    const result = visibleNavGroups([{ title: 'Armazém', links: [{ href: '/warehouses', label: 'Armazéns', icon: 'building' }] }], false);
    expect(result).toHaveLength(0);
  });
});
