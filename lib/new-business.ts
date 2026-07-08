import type { BusinessIconKey } from "@/lib/business-avatar";

export interface NewBusinessInput {
  name: string;
  description: string;
  avatarEmoji: string | null;
  avatarIcon: BusinessIconKey | null;
}