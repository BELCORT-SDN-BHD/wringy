// Static message catalogue for the three locales.
//
// Every namespace is imported statically and merged under its own top-level key,
// so a component asks for `common.shell`, `public.campaign`, `notifications.kinds`
// and so on. Wave-2 workers only edit their own `<role>.json` files: this module
// already imports `merchant`, `creator` and `ops` for all three locales, so nobody
// needs to touch it again.
//
// The locale is not in the URL (kickoff decision 8), so the client switches
// messages in place from this object instead of navigating.

import { LOCALES, type Locale } from '@/domain/types';

import enCommon from '../messages/en-MY/common.json';
import enPublic from '../messages/en-MY/public.json';
import enNotifications from '../messages/en-MY/notifications.json';
import enDemo from '../messages/en-MY/demo.json';
import enSettings from '../messages/en-MY/settings.json';
import enMerchant from '../messages/en-MY/merchant.json';
import enCreator from '../messages/en-MY/creator.json';
import enOps from '../messages/en-MY/ops.json';
import enInternal from '../messages/en-MY/internal.json';

import msCommon from '../messages/ms-MY/common.json';
import msPublic from '../messages/ms-MY/public.json';
import msNotifications from '../messages/ms-MY/notifications.json';
import msDemo from '../messages/ms-MY/demo.json';
import msSettings from '../messages/ms-MY/settings.json';
import msMerchant from '../messages/ms-MY/merchant.json';
import msCreator from '../messages/ms-MY/creator.json';
import msOps from '../messages/ms-MY/ops.json';
import msInternal from '../messages/ms-MY/internal.json';

import zhCommon from '../messages/zh-Hans-MY/common.json';
import zhPublic from '../messages/zh-Hans-MY/public.json';
import zhNotifications from '../messages/zh-Hans-MY/notifications.json';
import zhDemo from '../messages/zh-Hans-MY/demo.json';
import zhSettings from '../messages/zh-Hans-MY/settings.json';
import zhMerchant from '../messages/zh-Hans-MY/merchant.json';
import zhCreator from '../messages/zh-Hans-MY/creator.json';
import zhOps from '../messages/zh-Hans-MY/ops.json';
import zhInternal from '../messages/zh-Hans-MY/internal.json';

/**
 * The namespaces every locale must carry. `internal` is the internal build's
 * own copy (M2-01); the (internal) root layout hands the client only `common`
 * and `internal`.
 */
export const NAMESPACES = [
  'common',
  'public',
  'notifications',
  'demo',
  'settings',
  'merchant',
  'creator',
  'ops',
  'internal',
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const messagesByLocale = {
  'en-MY': {
    common: enCommon,
    public: enPublic,
    notifications: enNotifications,
    demo: enDemo,
    settings: enSettings,
    merchant: enMerchant,
    creator: enCreator,
    ops: enOps,
    internal: enInternal,
  },
  'ms-MY': {
    common: msCommon,
    public: msPublic,
    notifications: msNotifications,
    demo: msDemo,
    settings: msSettings,
    merchant: msMerchant,
    creator: msCreator,
    ops: msOps,
    internal: msInternal,
  },
  'zh-Hans-MY': {
    common: zhCommon,
    public: zhPublic,
    notifications: zhNotifications,
    demo: zhDemo,
    settings: zhSettings,
    merchant: zhMerchant,
    creator: zhCreator,
    ops: zhOps,
    internal: zhInternal,
  },
} as const;

export type AppMessages = (typeof messagesByLocale)['en-MY'];

export function getMessages(locale: Locale): AppMessages {
  return messagesByLocale[locale] as AppMessages;
}

export { LOCALES };
export type { Locale };
