import type { N8nConfig } from '@/lib/types';

const STORAGE_KEY = 'n8nConfig';

export function loadN8nConfig(): N8nConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as N8nConfig;
    if (!parsed.baseUrl || !parsed.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveN8nConfig(config: N8nConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearN8nConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function defaultN8nConfig(): N8nConfig {
  return {
    baseUrl: 'http://127.0.0.1:5678',
    apiKey: '',
  };
}