// The site's pages, in menu order. SiteHeader and SiteFooter both list them.
// The parking tracker is the product; the signal tools are the next stage.
export interface NavLink {
  href: string;
  key: string;
  label: string;
  cls?: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", key: "home", label: "Home" },
  { href: "/tracker", key: "tracker", label: "Parking tracker", cls: "nav-demo" },
  { href: "/city", key: "city", label: "District" },
  { href: "/parking", key: "parking", label: "Parking accuracy" },
  { href: "/banner", key: "banner", label: "Billboards" },
  { href: "/audit", key: "audit", label: "Signal audit" },
  { href: "/network", key: "network", label: "Green wave 3D" },
  { href: "/roads", key: "roads", label: "Roads" },
  { href: "/elsewhere", key: "elsewhere", label: "Elsewhere" },
  { href: "/method", key: "method", label: "Method" },
  { href: "/team", key: "team", label: "Team" },
];
