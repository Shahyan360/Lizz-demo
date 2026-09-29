/**
 * Global application navigation config. Kept in a plain (non-client) module so
 * both the client `AppHeader` and server pages (which offset their content below
 * the fixed header) can import it.
 */

import type { ComponentType, SVGProps } from "react";
import {
  DashboardIcon,
  MailIcon,
  TasksIcon,
  PipelineIcon,
  ContactsIcon,
  CompaniesIcon,
  BuildingsIcon,
} from "./icons";


/** Height of the fixed global header, in pixels. */
export const APP_HEADER_HEIGHT = 52;

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

/** Top-level destinations shown in the global header. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/zoho", label: "Mailbox", icon: MailIcon },
  { href: "/planner", label: "Tasks & Meetings", icon: TasksIcon },
  { href: "/deals", label: "Pipeline", icon: PipelineIcon },
  { href: "/contacts", label: "Contacts", icon: ContactsIcon },
  { href: "/companies", label: "Companies", icon: CompaniesIcon },
  { href: "/properties", label: "Properties", icon: BuildingsIcon },
  { href: "/ai-assistant", label: "AI Assistant", icon: TasksIcon },
];

