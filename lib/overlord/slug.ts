export function slugifyProfileKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isReservedProfileKey(key: string): boolean {
  const k = key.trim().toLowerCase();
  return !k || k === "default";
}

export function isValidProfileKey(key: string): boolean {
  if (isReservedProfileKey(key)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key.trim().toLowerCase());
}
