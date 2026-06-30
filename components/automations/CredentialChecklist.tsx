"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useN8nConnection } from "@/components/n8n/N8nConnectionProvider";
import type { CredentialMap, IntegrationRequirement } from "@/lib/automation-types";
import type { N8nCredentialSummary } from "@/lib/types";

interface CredentialChecklistProps {
  integrations: IntegrationRequirement[];
  credentialMap: CredentialMap;
  onChange: (map: CredentialMap) => void;
  disabled?: boolean;
}

export function CredentialChecklist({
  integrations,
  credentialMap,
  onChange,
  disabled,
}: CredentialChecklistProps) {
  const { config, isConnected } = useN8nConnection();
  const [credentials, setCredentials] = useState<N8nCredentialSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCredentials = useCallback(async () => {
    if (!config?.baseUrl || !config.apiKey) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      });
      const res = await fetch(`/api/n8n/credentials?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setCredentials(data.credentials || []);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (isConnected) void loadCredentials();
  }, [isConnected, loadCredentials]);

  if (integrations.length === 0) {
    return (
      <p className="text-xs text-zinc-500">No integrations identified yet.</p>
    );
  }

  if (!isConnected) {
    return (
      <p className="text-xs text-amber-400">Connect n8n to map credentials.</p>
    );
  }

  function handleSelect(integrationName: string, credId: string) {
    const cred = credentials.find((c) => c.id === credId);
    if (!cred) return;
    onChange({
      ...credentialMap,
      [integrationName]: { id: cred.id, name: cred.name, type: cred.type },
    });
  }

  return (
    <div className="space-y-2">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading credentials…
        </div>
      )}
      {integrations.map((item) => (
        <div key={item.name} className="text-xs space-y-1">
          <div className="text-zinc-300 font-medium">{item.name}</div>
          <select
            className="input w-full text-xs py-1.5"
            disabled={disabled || loading}
            value={credentialMap[item.name]?.id ?? ""}
            onChange={(e) => handleSelect(item.name, e.target.value)}
          >
            <option value="">Select n8n credential…</option>
            {credentials.map((cred) => (
              <option key={cred.id} value={cred.id}>
                {cred.name} ({cred.type})
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}