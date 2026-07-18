export type ForgeOverlordSummary = {
  profileKey: string;
  displayName: string;
  hermesHome: string;
  setAt: string | null;
};

export type ScannedOverlordCandidate = {
  profileKey: string;
  displayName: string;
  description: string | null;
  model: string | null;
  hermesHome: string;
  isDefault: boolean;
};
