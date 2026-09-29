export const REPLY_SIGNER = process.env.REPLY_SIGNER?.trim() || "Lizzz";

/** Names used in Evernote `Route To:` lines and internal handoff emails. */
// Compatibility defaults for UI code that cannot query Prisma during render.
// Server-side routing must validate against the tenant's active TeamMember rows.
export const ROUTE_TO_TEAMMATES = ["Dave", "Mathew", "Sarah", "Beverly"] as const;
export type RouteToTeammate = string;

/** AutoGate internal team — @-mention CC, scheduling/admin CC, and Route To handoff emails. */
export const AUTOGATE_TEAM = [
  { name: "Lizzz Delagente", email: "adnanzahidpro@gmail.com" },
  { name: "Brian McAnderson", email: "adnanzahidpro@gmail.com" },
  { name: "Dave", email: "adnanzahidpro@gmail.com", routeTo: "Dave" },
  { name: "Mathew", email: "adnanzahidpro@gmail.com", routeTo: "Mathew" },
  { name: "Sarah", email: "adnanzahidpro@gmail.com", routeTo: "Sarah" },
  { name: "Beverly", email: "adnanzahidpro@gmail.com", routeTo: "Beverly" },
] as const;
// export const AUTOGATE_TEAM = [
//   { name: "Lizzz Delagente", email: "max@myautogate.com" },
//   { name: "Brian McAnderson", email: "brianm@myautogate.com" },
//   { name: "Dave White", email: "dave@myautogate.com", routeTo: "Dave" },
//   { name: "Sarah S", email: "sarahs@myautogate.com", routeTo: "Sarah" },
//   { name: "Beverly", email: "beverly@myautogate.com", routeTo: "Beverly" },
// ] as const;

export interface RoutableTeammate {
  routeTo: RouteToTeammate;
  name: string;
  email: string;
}

/** Compatibility roster for UI fallbacks; live server routing uses TeamMember rows. */
export function getRoutableTeammates(): RoutableTeammate[] {
  return AUTOGATE_TEAM.filter(
    (m): m is typeof m & { routeTo: RouteToTeammate } => "routeTo" in m
  ).map((m) => ({
    routeTo: m.routeTo,
    name: m.name,
    email: m.email,
  }));
}

export function isRouteToTeammate(value: string): value is RouteToTeammate {
  return (ROUTE_TO_TEAMMATES as readonly string[]).includes(value.trim());
}

export function memberAgendaPath(routeTo: string): string {
  return `/planner/team/${routeTo.trim().toLowerCase()}`;
}

/** Resolve an inbox for compatibility callers; live handoffs use the tenant roster. */
export function emailForRouteTo(routeTo: string): string | undefined {
  const key = routeTo.trim();
  for (const member of AUTOGATE_TEAM) {
    if ("routeTo" in member && member.routeTo === key) {
      return member.email.toLowerCase();
    }
    const first = member.name.split(/\s+/)[0];
    if (first === key) return member.email.toLowerCase();
  }
  return undefined;
}

export const EVERNOTE_FORWARD = {
  address: "adnannalvi675115117cd578d6d69.425d320f@m.evernote.com",
  subjectSuffix: "+New Follow Up Proposals",
  schedulingSubjectSuffix: "+Scheduling Request",
  adminSubjectSuffix: "+Admin Follow Up",
} as const;
// export const EVERNOTE_FORWARD = {
//   address: "myautogate.c6d3695@m.evernote.com",
//   subjectSuffix: "+New Follow Up Proposals",
//   schedulingSubjectSuffix: "+Scheduling Request",
//   adminSubjectSuffix: "+Admin Follow Up",
// } as const;

/** Product/service lines AutoGate Electric offers — source of truth for product-info replies. */
export const PRODUCT_CATEGORIES = [
  "multi_family_commercial",
  "residential_gates",
  "access_control",
  "video_surveillance",
  "automatic_gates",
  "license_plate_capture",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface ProductLine {
  id: ProductCategory;
  name: string;
  tagline: string;
  overview: string;
  capabilities: string[];
  typicalApplications: string[];
  relatedServices: string[];
}

export const PRODUCT_CATALOG: Record<ProductCategory, ProductLine> = {
  multi_family_commercial: {
    id: "multi_family_commercial",
    name: "Multi-Family & Commercial",
    tagline:
      "Specialized solutions for apartments, condos, and commercial properties.",
    overview:
      "AutoGate Electric designs, installs, and maintains gate and access systems built for high-traffic multi-family and commercial sites — including apartment communities, condominiums, office parks, retail centers, and industrial properties.",
    capabilities: [
      "Multi-lane entry/exit control for resident, visitor, and vendor traffic",
      "Integration with access control, telephone entry, and video surveillance",
      "UL 325–compliant automatic gate systems for commercial duty cycles",
      "Preventive maintenance programs to reduce downtime on busy properties",
      "Coordination with property managers, HOAs, and general contractors",
    ],
    typicalApplications: [
      "Apartment and condo community main entrances",
      "Commercial parking garages and loading areas",
      "Gated business parks and mixed-use developments",
    ],
    relatedServices: ["access_control", "automatic_gates", "license_plate_capture", "video_surveillance"],
  },
  residential_gates: {
    id: "residential_gates",
    name: "Residential Gates",
    tagline: "Custom automatic gate solutions for single-family homes.",
    overview:
      "We provide custom automatic gate solutions for single-family homes — from new installations and replacements to upgrades on existing driveway and estate gates.",
    capabilities: [
      "Slide, swing, and barrier-style residential gate systems",
      "Matching gate operators, safety devices, and access hardware",
      "Telephone entry, mobile access, and keypad options",
      "Repair, troubleshooting, and preventive maintenance",
      "Site evaluation to confirm power, clearance, and safety requirements",
    ],
    typicalApplications: [
      "Driveway gates for single-family homes",
      "Estate and privacy entrances",
      "Replacing aging operators or upgrading manual gates to automatic",
    ],
    relatedServices: ["automatic_gates", "access_control", "video_surveillance"],
  },
  access_control: {
    id: "access_control",
    name: "Access Control",
    tagline:
      "Advanced access control systems with telephone entry and mobile key solutions.",
    overview:
      "AutoGate Electric installs and supports access control systems that manage who can enter a property — combining credentials, telephone entry, mobile credentials, and integration with gates and doors.",
    capabilities: [
      "Telephone entry and video intercom at gates and doors",
      "Mobile app and cloud-based credential management",
      "Keypads, card/fob readers, and visitor management workflows",
      "Integration with automatic gates and pedestrian doors",
      "Multi-tenant and multi-entry-point system design",
    ],
    typicalApplications: [
      "Gated community resident and visitor access",
      "Commercial building entry and amenity access",
      "Replacing legacy call boxes or outdated key systems",
    ],
    relatedServices: ["multi_family_commercial", "residential_gates", "automatic_gates"],
  },
  video_surveillance: {
    id: "video_surveillance",
    name: "Video Surveillance",
    tagline:
      "State-of-the-art camera systems for comprehensive property protection.",
    overview:
      "We design and install video surveillance systems to monitor gates, parking areas, common spaces, and perimeter locations — with options for local recording and remote viewing.",
    capabilities: [
      "IP camera systems for entry points, driveways, and common areas",
      "Night/low-light coverage and wide-area views",
      "Local NVR/recorder setup and remote viewing configuration",
      "Camera placement planning for gates, lobbies, and parking",
      "Integration with access control and gate automation where needed",
    ],
    typicalApplications: [
      "Gate and driveway monitoring for homes and communities",
      "Parking lot and loading dock coverage for commercial sites",
      "Security upgrades alongside access control projects",
    ],
    relatedServices: ["license_plate_capture", "access_control", "multi_family_commercial"],
  },
  automatic_gates: {
    id: "automatic_gates",
    name: "Automatic Gates",
    tagline:
      "Professional installation and maintenance of slide gates, swing gates, and barrier arms.",
    overview:
      "AutoGate Electric specializes in automatic gate installation, repair, and maintenance — including slide gates, swing gates, and barrier arms for residential and commercial properties.",
    capabilities: [
      "New gate automation and operator replacement",
      "Slide, swing, and barrier-arm systems",
      "Safety loops, photo eyes, and UL 325 compliance considerations",
      "Emergency release, troubleshooting, and ongoing maintenance",
      "Upgrades from manual to automatic operation",
    ],
    typicalApplications: [
      "Driveway slide or swing gates",
      "Commercial barrier arms for controlled vehicular access",
      "Repairing or modernizing existing gate operators",
    ],
    relatedServices: ["residential_gates", "multi_family_commercial", "access_control"],
  },
  license_plate_capture: {
    id: "license_plate_capture",
    name: "License Plate Capture (LPC)",
    tagline:
      "Advanced LPC cameras for vehicle identification and enhanced security monitoring.",
    overview:
      "License Plate Capture (LPC) cameras identify vehicles at entry and exit points — supporting access logs, visitor tracking, and enhanced security monitoring when paired with gates and surveillance.",
    capabilities: [
      "Dedicated LPC cameras positioned for reliable plate reads day and night",
      "Capture at community entrances, parking structures, and commercial gates",
      "Integration with access control and video surveillance systems",
      "Improved visibility for property managers reviewing entry activity",
      "Site planning for lane layout, lighting, and camera angles",
    ],
    typicalApplications: [
      "Apartment and HOA vehicle entry logging",
      "Commercial gate lanes with audit requirements",
      "Security upgrades combined with CCTV at entrances",
    ],
    relatedServices: ["video_surveillance", "access_control", "multi_family_commercial"],
  },
};

/** Human-readable catalog block for LLM prompts and reviewer follow-up notes. */
export function formatProductCatalogForPrompt(
  categories: ProductCategory[] = [...PRODUCT_CATEGORIES]
): string {
  return categories
    .map((id) => {
      const p = PRODUCT_CATALOG[id];
      return [
        `## ${p.name}`,
        p.tagline,
        p.overview,
        "Capabilities:",
        ...p.capabilities.map((c) => `- ${c}`),
        "Typical applications:",
        ...p.typicalApplications.map((a) => `- ${a}`),
      ].join("\n");
    })
    .join("\n\n");
}

export function getProductLine(category: string): ProductLine | undefined {
  return PRODUCT_CATALOG[category as ProductCategory];
}

/** Cities and regions AutoGate Electric actively serves. */
export const SERVICE_AREAS = {
  northernVirginia: [
    "Fairfax",
    "Alexandria",
    "Great Falls",
    "Reston",
    "Burke",
    "Falls Church",
    "Herndon",
    "Chantilly",
    "Lorton",
    "Fort Belvoir",
    "Arlington",
    "McLean",
    "Vienna",
    "Springfield",
    "Annandale",
    "Tysons",
    "Centreville",
    "Oakton",
    "Mount Vernon",
    "Merrifield",
  ],
  maryland: [
    "Bethesda",
    "Rockville",
    "Chevy Chase",
    "Potomac",
    "Silver Spring",
  ],
  washingtonDc: [
    "Northwest DC",
    "Southeast DC",
    "N\u006frtheast DC",
    "Southwest DC",
  ],
} as const;

/** Human-readable service-area block for LLM prompts (compact — one line per region). */
export function formatServiceAreasForPrompt(): string {
  return [
    "Service areas we actively work in:",
    `- Northern Virginia: ${SERVICE_AREAS.northernVirginia.join(", ")}`,
    `- Maryland: ${SERVICE_AREAS.maryland.join(", ")}`,
    `- Washington DC: ${SERVICE_AREAS.washingtonDc.join(", ")}`,
    "Confirm coverage if the customer's city/area matches above; otherwise say the team will confirm — don't promise service.",
  ].join("\n");
}

/** Case-insensitive check whether a location string matches a listed service area. */
export function isListedServiceArea(location: string): boolean {
  const needle = location.trim().toLowerCase();
  if (!needle) return false;

  const allAreas = [
    ...SERVICE_AREAS.northernVirginia,
    ...SERVICE_AREAS.maryland,
    ...SERVICE_AREAS.washingtonDc,
    "Northern Virginia",
    "Maryland",
    "Washington DC",
    "DC",
  ];

  return allAreas.some(
    (area) =>
      needle.includes(area.toLowerCase()) || area.toLowerCase().includes(needle)
  );
}
