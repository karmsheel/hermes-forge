"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PersonnelIconPicker } from "@/components/personnel/PersonnelIconPicker";

export interface HumanEmployeeItem {
  kind: "human";
  id: string;
  name: string;
  role: string;
  roleDescription: string | null;
  isOwner: boolean;
  iconKey: string | null;
}

export interface AgentEmployeeItem {
  kind: "agent";
  id: string;
  displayName: string;
  description: string | null;
  model: string | null;
  profileKey: string;
  isDefault: boolean;
  isHired: boolean;
  iconKey: string | null;
}

export type EmployeeItem = HumanEmployeeItem | AgentEmployeeItem;

interface PersonnelMemberCardProps {
  employee: EmployeeItem;
  onIconChange: (id: string, kind: "human" | "agent", iconKey: string | null) => void;
  onFireHuman: (id: string) => Promise<void>;
  onFireAgent: (id: string) => Promise<void>;
}

const MENU_WIDTH = 168;

export function PersonnelMemberCard({
  employee,
  onIconChange,
  onFireHuman,
  onFireAgent,
}: PersonnelMemberCardProps) {
  const [iconKey, setIconKey] = useState(employee.iconKey);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [fireConfirm, setFireConfirm] = useState(false);
  const [firing, setFiring] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const isOwner = employee.kind === "human" && employee.isOwner;
  const isHuman = employee.kind === "human";
  const name = isHuman ? employee.name : employee.displayName;
  const fireMenuLabel = isHuman ? "Remove from organization" : "Fire from organization";
  const fireConfirmTitle = isHuman ? "Remove from organization?" : "Fire from organization?";
  const fireConfirmAction = isHuman ? "Remove" : "Fire";
  const subtitle =
    employee.kind === "human"
      ? employee.role
      : employee.model || (employee.isDefault ? "Default agent" : "Hermes agent");

  const closeMenu = useCallback(() => {
    menuTriggerRef.current = null;
    setMenuOpen(false);
    setMenuAnchor(null);
  }, []);

  useEffect(() => {
    setIconKey(employee.iconKey);
  }, [employee.iconKey]);

  useEffect(() => {
    if (!menuOpen) return;

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || menuTriggerRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, menuOpen]);

  function toggleMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (menuOpen) {
      closeMenu();
      return;
    }
    menuTriggerRef.current = e.currentTarget;
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuAnchor({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - MENU_WIDTH),
    });
    setMenuOpen(true);
  }

  async function confirmFire() {
    setFiring(true);
    try {
      if (employee.kind === "human") {
        await onFireHuman(employee.id);
      } else {
        await onFireAgent(employee.id);
      }
      setFireConfirm(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove employee");
    } finally {
      setFiring(false);
    }
  }

  return (
    <>
      <li className={`personnel-card${isOwner ? " is-owner" : ""}`}>
        <div className="personnel-card__visual">
          <PersonnelIconPicker
            kind={employee.kind}
            memberId={employee.id}
            iconKey={iconKey}
            isOwner={isOwner}
            onIconChange={(next) => {
              setIconKey(next);
              onIconChange(employee.id, employee.kind, next);
            }}
          />
          {!isOwner && (
            <div className="personnel-card__menu">
              <button
                type="button"
                onClick={toggleMenu}
                className={`workflow-menu__trigger personnel-card__menu-trigger${
                  menuOpen ? " is-open" : ""
                }`}
                title="Employee options"
                aria-label={`Options for ${name}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="personnel-card__body">
          <div className="personnel-card__name-row">
            <span className="personnel-card__name" title={name}>
              {name}
            </span>
            {isOwner && (
              <span className="personnel-card__badge personnel-card__badge--owner">
                <Crown className="w-2.5 h-2.5" />
                Owner
              </span>
            )}
            {employee.kind === "agent" && employee.isHired && (
              <span className="personnel-card__badge personnel-card__badge--hired">Hired</span>
            )}
          </div>
          <span className="personnel-card__meta" title={subtitle}>
            {subtitle}
          </span>
        </div>
      </li>

      {menuOpen && menuAnchor && (
        <div
          ref={menuRef}
          className="workflow-menu__popover workflow-menu__popover--fixed"
          role="menu"
          aria-label={`Options for ${name}`}
          style={{ top: menuAnchor.top, left: menuAnchor.left, width: MENU_WIDTH }}
        >
          <button
            type="button"
            role="menuitem"
            className="workflow-menu__item workflow-menu__item--danger"
            onClick={(e) => {
              e.stopPropagation();
              closeMenu();
              setFireConfirm(true);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {fireMenuLabel}
          </button>
        </div>
      )}

      {fireConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close fire confirmation"
            onClick={() => !firing && setFireConfirm(false)}
            disabled={firing}
          />
          <div className="relative w-full max-w-md card p-6">
            <h2 className="text-xl font-semibold tracking-tight">{fireConfirmTitle}</h2>
            <p className="text-sm text-text-muted mt-2">
              This will remove{" "}
              <span className="font-medium text-text">&quot;{name}&quot;</span> from this business.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setFireConfirm(false)}
                disabled={firing}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmFire()}
                disabled={firing}
                className="btn-primary text-sm bg-red-600 hover:bg-red-700 focus:bg-red-700 disabled:opacity-50"
              >
                {firing ? <Loader2 className="w-4 h-4 animate-spin" /> : fireConfirmAction}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}