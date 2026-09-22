/**
 * Sidebar navigation per simulated role.
 *
 * `labelKey` is a key under the `common.nav` namespace, so a language switch
 * never touches this file. The hrefs are the route map from
 * docs/m1-prototype/kickoff.md; the pages behind most of them are built by the
 * wave-2 role workers under `src/app/(workspace)/<role>/…`.
 */

import {
  Bell,
  Building2,
  ChartNoAxesColumn,
  FileVideo,
  Gavel,
  HandCoins,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Banknote,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import type { Role } from '@/domain/types';

export interface NavItem {
  /** Key under `common.nav`. */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  /** True when the item should match nested routes too. */
  prefix?: boolean;
}

export interface NavGroup {
  /** Key under `common.nav`. */
  labelKey: string;
  items: NavItem[];
}

const CREATOR_ITEMS: NavItem[] = [
  { labelKey: 'overview', href: '/creator', icon: LayoutDashboard },
  { labelKey: 'accounts', href: '/creator/accounts', icon: UserRound, prefix: true },
  { labelKey: 'submissions', href: '/creator/submissions', icon: FileVideo, prefix: true },
  { labelKey: 'claims', href: '/creator/claims', icon: HandCoins, prefix: true },
  { labelKey: 'payments', href: '/creator/payments', icon: Wallet, prefix: true },
];

const MERCHANT_ITEMS: NavItem[] = [
  { labelKey: 'overview', href: '/merchant', icon: LayoutDashboard },
  { labelKey: 'campaigns', href: '/merchant/campaigns', icon: Megaphone, prefix: true },
  { labelKey: 'submissions', href: '/merchant/submissions', icon: FileVideo, prefix: true },
  { labelKey: 'reports', href: '/merchant/reports', icon: ChartNoAxesColumn, prefix: true },
];

// `/ops` is the queue itself: the ops worker replaces the placeholder page there
// with the real work queue, so the first nav item is never a dead link.
const OPS_ITEMS: NavItem[] = [
  { labelKey: 'queue', href: '/ops', icon: ListChecks },
  { labelKey: 'submissions', href: '/ops/submissions', icon: FileVideo, prefix: true },
  { labelKey: 'claims', href: '/ops/claims', icon: HandCoins, prefix: true },
  { labelKey: 'appeals', href: '/ops/appeals', icon: Gavel, prefix: true },
  { labelKey: 'payouts', href: '/ops/payouts', icon: Banknote, prefix: true },
  { labelKey: 'exceptions', href: '/ops/exceptions', icon: TriangleAlert, prefix: true },
  { labelKey: 'readiness', href: '/ops/readiness', icon: ShieldCheck, prefix: true },
];

/** Shown to every signed-in identity, under its own group. */
const ACCOUNT_ITEMS: NavItem[] = [
  { labelKey: 'notifications', href: '/notifications', icon: Bell },
  { labelKey: 'settings', href: '/settings', icon: Settings },
];

/** The workspace landing page for a role, used after sign-in and by guards. */
export const ROLE_HOME: Record<Exclude<Role, 'guest'>, string> = {
  creator: '/creator',
  merchant: '/merchant',
  ops_reviewer: '/ops',
  ops_finance: '/ops',
};

export function navGroupsFor(role: Role): NavGroup[] {
  switch (role) {
    case 'creator':
      return [
        { labelKey: 'groupCreator', items: CREATOR_ITEMS },
        { labelKey: 'groupAccount', items: ACCOUNT_ITEMS },
      ];
    case 'merchant':
      return [
        { labelKey: 'groupMerchant', items: MERCHANT_ITEMS },
        { labelKey: 'groupAccount', items: ACCOUNT_ITEMS },
      ];
    case 'ops_reviewer':
    case 'ops_finance':
      return [
        { labelKey: 'groupOps', items: OPS_ITEMS },
        { labelKey: 'groupAccount', items: ACCOUNT_ITEMS },
      ];
    default:
      return [{ labelKey: 'groupAccount', items: ACCOUNT_ITEMS }];
  }
}

/** Route prefixes that belong to each role, used by `RequireRole`. */
export const ROLE_ROUTE_PREFIX: Record<string, Array<Exclude<Role, 'guest'>>> = {
  '/creator': ['creator'],
  '/merchant': ['merchant'],
  '/ops': ['ops_reviewer', 'ops_finance'],
};

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.prefix) return pathname === item.href || pathname.startsWith(`${item.href}/`);
  return pathname === item.href;
}

export const WORKSPACE_ICON = Building2;
