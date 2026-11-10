export type NavLink = { href: string; label: string; icon: string };
export type NavGroup = { title: string; links: NavLink[] };

/**
 * Esconde o acesso ao WMS na navegação quando o pacote não o inclui.
 * Os restantes links do grupo mantêm-se visíveis.
 */
export function visibleNavGroups(groups: NavGroup[], wmsEnabled: boolean): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => {
        const isWms = link.href === '/warehouses' || link.href === '/stock' || link.href.startsWith('/stock/');
        return !isWms || wmsEnabled;
      }),
    }))
    .filter((group) => group.links.length > 0);
}
