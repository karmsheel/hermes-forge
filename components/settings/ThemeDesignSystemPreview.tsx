"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { forgeVarsFromSkin } from "@/lib/themes/apply-skin";
import {
  buildForgeTokenGroups,
  buildSkinPaletteGroups,
  countDesignTokens,
  isShadowTokenValue,
  isSolidSwatchValue,
  type DesignTokenEntry,
  type DesignTokenGroup,
} from "@/lib/themes/design-system-catalog";
import { resolveSkinPalette } from "@/lib/themes/presets";

function TokenSwatch({ token }: { token: DesignTokenEntry }) {
  const shadow = isShadowTokenValue(token.value);

  if (shadow) {
    return (
      <div className="theme-ds-preview__shadow-stage" aria-hidden>
        <div className="theme-ds-preview__shadow-sample" style={{ boxShadow: token.value }} />
      </div>
    );
  }

  if (!isSolidSwatchValue(token.value)) {
    return (
      <div className="theme-ds-preview__swatch theme-ds-preview__swatch--fallback" aria-hidden>
        <span className="theme-ds-preview__swatch-glyph">◇</span>
      </div>
    );
  }

  return (
    <div
      className="theme-ds-preview__swatch"
      style={{ background: token.value }}
      aria-hidden
    />
  );
}

function AccordionTrigger({
  id,
  title,
  count,
  subtitle,
  level,
  expanded,
  onToggle,
}: {
  id: string;
  title: string;
  count: number;
  subtitle?: string;
  level: "layer" | "group";
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      id={`${id}-trigger`}
      className={`theme-ds-preview__accordion-trigger theme-ds-preview__accordion-trigger--${level}`}
      aria-expanded={expanded}
      aria-controls={`${id}-panel`}
      onClick={() => onToggle(id)}
    >
      <ChevronDown
        className={`theme-ds-preview__chevron${expanded ? " is-open" : ""}`}
        aria-hidden
      />
      <span className="theme-ds-preview__accordion-main">
        <span className="theme-ds-preview__accordion-title">{title}</span>
        {subtitle ? (
          <span className="theme-ds-preview__accordion-subtitle">{subtitle}</span>
        ) : null}
      </span>
      <span className="theme-ds-preview__accordion-count">{count}</span>
    </button>
  );
}

function TokenGroupAccordion({
  group,
  expanded,
  onToggle,
}: {
  group: DesignTokenGroup;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className={`theme-ds-preview__accordion theme-ds-preview__accordion--group${expanded ? " is-open" : ""}`}>
      <AccordionTrigger
        id={group.id}
        title={group.label}
        count={group.tokens.length}
        level="group"
        expanded={expanded}
        onToggle={onToggle}
      />
      {expanded ? (
        <div
          id={`${group.id}-panel`}
          role="region"
          aria-labelledby={`${group.id}-trigger`}
          className="theme-ds-preview__accordion-panel theme-ds-preview__accordion-panel--group"
        >
          <div className="theme-ds-preview__token-grid">
            {group.tokens.map((token) => (
              <div key={token.key} className="theme-ds-preview__token" title={token.value}>
                <TokenSwatch token={token} />
                <div className="theme-ds-preview__token-meta">
                  <span className="theme-ds-preview__token-label">{token.label}</span>
                  <code className="theme-ds-preview__token-value">{token.value}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LayerAccordion({
  id,
  title,
  count,
  subtitle,
  description,
  groups,
  expanded,
  onToggle,
  groupExpanded,
  onGroupToggle,
}: {
  id: string;
  title: string;
  count: number;
  subtitle: string;
  description: string;
  groups: DesignTokenGroup[];
  expanded: boolean;
  onToggle: (id: string) => void;
  groupExpanded: (id: string) => boolean;
  onGroupToggle: (id: string) => void;
}) {
  return (
    <div className={`theme-ds-preview__accordion theme-ds-preview__accordion--layer${expanded ? " is-open" : ""}`}>
      <AccordionTrigger
        id={id}
        title={title}
        count={count}
        subtitle={subtitle}
        level="layer"
        expanded={expanded}
        onToggle={onToggle}
      />
      {expanded ? (
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-trigger`}
          className="theme-ds-preview__accordion-panel theme-ds-preview__accordion-panel--layer"
        >
          <p className="theme-ds-preview__layer-desc">{description}</p>
          <div className="theme-ds-preview__groups">
            {groups.map((group) => (
              <TokenGroupAccordion
                key={group.id}
                group={group}
                expanded={groupExpanded(group.id)}
                onToggle={onGroupToggle}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ThemeDesignSystemPreview() {
  const { skin, resolved } = useTheme();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isExpanded = useCallback((id: string) => expandedIds.has(id), [expandedIds]);

  const { palette, paletteGroups, forgeGroups, totalTokens, paletteCount, forgeCount } =
    useMemo(() => {
      const palette = resolveSkinPalette(skin, resolved);
      const forgeVars = forgeVarsFromSkin(skin, resolved);
      const paletteGroups = buildSkinPaletteGroups(palette);
      const forgeGroups = buildForgeTokenGroups(forgeVars);
      return {
        palette,
        paletteGroups,
        forgeGroups,
        paletteCount: countDesignTokens(paletteGroups),
        forgeCount: countDesignTokens(forgeGroups),
        totalTokens: countDesignTokens(paletteGroups) + countDesignTokens(forgeGroups),
      };
    }, [skin, resolved]);

  const modeLabel = resolved === "dark" ? "Night palette" : "Day palette";

  return (
    <div
      className="theme-ds-preview"
      aria-label={`${skin.label} design system preview`}
      style={{ "--ds-preview-accent": palette.primary } as CSSProperties}
    >
      <div className="theme-ds-preview__shell">
        <header className="theme-ds-preview__header">
          <div>
            <h3 className="theme-ds-preview__title">Design system</h3>
            <p className="theme-ds-preview__subtitle">
              {skin.label} · {modeLabel} · {totalTokens} color tokens
            </p>
          </div>
          <p className="theme-ds-preview__hint">Read-only · expand a section to inspect colors</p>
        </header>

        <div className="theme-ds-preview__layers">
          <LayerAccordion
            id="layer-palette"
            title="Theme palette"
            count={paletteCount}
            subtitle="Source colors"
            description={`Seed colors defined by the ${skin.label} theme before Forge derives UI tokens.`}
            groups={paletteGroups}
            expanded={isExpanded("layer-palette")}
            onToggle={toggle}
            groupExpanded={isExpanded}
            onGroupToggle={toggle}
          />

          <LayerAccordion
            id="layer-forge"
            title="Applied tokens"
            count={forgeCount}
            subtitle="Derived CSS variables"
            description={`CSS variables applied when ${skin.label} is active in ${resolved} mode.`}
            groups={forgeGroups}
            expanded={isExpanded("layer-forge")}
            onToggle={toggle}
            groupExpanded={isExpanded}
            onGroupToggle={toggle}
          />
        </div>
      </div>
    </div>
  );
}