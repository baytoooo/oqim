// The site's pages, in menu order. SiteHeader and SiteFooter both list them.
export interface NavLink {
  href: string;
  key: string;
  label: string;
  cls?: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", key: "home", label: "Home" },
  { href: "/method", key: "method", label: "Method" },
  { href: "/team", key: "team", label: "Team" },
  { href: "/audit", key: "audit", label: "Run an audit", cls: "nav-demo" },
];
