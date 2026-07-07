import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Briefcase,
  Crown,
  FlaskConical,
  GraduationCap,
  Headphones,
  HeartHandshake,
  Lightbulb,
  Megaphone,
  Microscope,
  Palette,
  PenTool,
  Rocket,
  Scale,
  Settings,
  Shield,
  Sparkles,
  Star,
  UserRound,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';

export const PERSONNEL_ICON_KEYS = [
  'user-round',
  'bot',
  'crown',
  'briefcase',
  'users',
  'headphones',
  'megaphone',
  'pen-tool',
  'palette',
  'lightbulb',
  'rocket',
  'shield',
  'wrench',
  'settings',
  'scale',
  'graduation-cap',
  'microscope',
  'flask-conical',
  'heart-handshake',
  'sparkles',
  'star',
  'zap',
] as const;

export type PersonnelIconKey = (typeof PERSONNEL_ICON_KEYS)[number];

const ICON_MAP: Record<PersonnelIconKey, LucideIcon> = {
  'user-round': UserRound,
  bot: Bot,
  crown: Crown,
  briefcase: Briefcase,
  users: Users,
  headphones: Headphones,
  megaphone: Megaphone,
  'pen-tool': PenTool,
  palette: Palette,
  lightbulb: Lightbulb,
  rocket: Rocket,
  shield: Shield,
  wrench: Wrench,
  settings: Settings,
  scale: Scale,
  'graduation-cap': GraduationCap,
  microscope: Microscope,
  'flask-conical': FlaskConical,
  'heart-handshake': HeartHandshake,
  sparkles: Sparkles,
  star: Star,
  zap: Zap,
};

export function isPersonnelIconKey(value: string): value is PersonnelIconKey {
  return (PERSONNEL_ICON_KEYS as readonly string[]).includes(value);
}

export function resolvePersonnelIcon(
  iconKey: string | null | undefined,
  kind: 'human' | 'agent',
  isOwner = false
): LucideIcon {
  if (isOwner) return Crown;
  if (iconKey && isPersonnelIconKey(iconKey)) return ICON_MAP[iconKey];
  return kind === 'agent' ? Bot : UserRound;
}

export function defaultIconKeyForKind(kind: 'human' | 'agent', isOwner = false): PersonnelIconKey {
  if (isOwner) return 'crown';
  return kind === 'agent' ? 'bot' : 'user-round';
}