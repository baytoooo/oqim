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
  { href: "/network", key: "network", label: "3D corridor" },
  { href: "/city", key: "city", label: "District" },
  { href: "/parking", key: "parking", label: "Parking" },
  { href: "/roads", key: "roads", label: "Roads" },
  { href: "/elsewhere", key: "elsewhere", label: "Elsewhere" },
  { href: "/team", key: "team", label: "Team" },
  { href: "/audit", key: "audit", label: "Run an audit", cls: "nav-demo" },
];
