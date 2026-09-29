import type { SVGProps } from "react";

/**
 * Shared crisp stroke icons (Feather-style) used across the whole app — the
 * navigation, headers, and action buttons. Monochrome: they inherit `color` via
 * `currentColor`, and default to 18px (override with width/height props).
 */

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  );
}

/* ── navigation ── */

export function DashboardIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Svg>
  );
}

export function MailIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </Svg>
  );
}

export function TasksIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Svg>
  );
}

export function PipelineIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <line x1="3" y1="21" x2="3" y2="10" />
      <line x1="9" y1="21" x2="9" y2="4" />
      <line x1="15" y1="21" x2="15" y2="13" />
      <line x1="21" y1="21" x2="21" y2="7" />
    </Svg>
  );
}

export function ContactsIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function CompaniesIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M15 21V9h4a2 2 0 0 1 2 2v10" />
      <line x1="9" y1="7" x2="9" y2="7.01" />
      <line x1="9" y1="11" x2="9" y2="11.01" />
      <line x1="9" y1="15" x2="9" y2="15.01" />
    </Svg>
  );
}

export function BuildingsIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M3 21h18" />
      <path d="M6 21V7l6-4 6 4v14" />
      <path d="M9 21v-6h6v6" />
      <line x1="9" y1="11" x2="9" y2="11.01" />
      <line x1="15" y1="11" x2="15" y2="11.01" />
      <line x1="9" y1="7" x2="9" y2="7.01" />
      <line x1="15" y1="7" x2="15" y2="7.01" />
    </Svg>
  );
}

export function InboxIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Svg>
  );
}

/* ── actions ── */

export function MenuIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </Svg>
  );
}

export function XIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

export function PlusIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

export function CheckIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

export function SearchIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  );
}

export function EditIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  );
}

export function TrashIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </Svg>
  );
}

export function UsersIcon(p: SVGProps<SVGSVGElement>) {
  return <ContactsIcon {...p} />;
}

export function BanIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </Svg>
  );
}

export function LogOutIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  );
}

export function ChevronLeftIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

export function ChevronRightIcon(p: SVGProps<SVGSVGElement>) {
  return (
    <Svg {...p}>
      <polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}
