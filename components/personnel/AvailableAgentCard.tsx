"use client";

import { useState } from "react";
import { PersonnelIconPicker } from "@/components/personnel/PersonnelIconPicker";

export interface AvailableAgentItem {
  id: string;
  displayName: string;
  description: string | null;
  model: string | null;
  profileKey: string;
  isDefault: boolean;
  iconKey: string | null;
}

interface AvailableAgentCardProps {
  agent: AvailableAgentItem;
  onIconChange: (id: string, iconKey: string | null) => void;
  onHire: (agent: AvailableAgentItem) => void;
}

export function AvailableAgentCard({ agent, onIconChange, onHire }: AvailableAgentCardProps) {
  const [iconKey, setIconKey] = useState(agent.iconKey);
  const subtitle = agent.model || (agent.isDefault ? "Default agent" : "Hermes agent");

  return (
    <li className="personnel-card">
      <div className="personnel-card__visual">
        <PersonnelIconPicker
          kind="agent"
          memberId={agent.id}
          iconKey={iconKey}
          onIconChange={(next) => {
            setIconKey(next);
            onIconChange(agent.id, next);
          }}
        />
      </div>

      <div className="personnel-card__body">
        <span className="personnel-card__name" title={agent.displayName}>
          {agent.displayName}
        </span>
        <span className="personnel-card__meta" title={subtitle}>
          {subtitle}
        </span>
        <button
          type="button"
          className="personnel-card__hire-btn"
          onClick={() => onHire(agent)}
        >
          Hire
        </button>
      </div>
    </li>
  );
}