"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useChatbar } from "@/components/chatbar/ChatbarProvider";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import { useShell } from "@/components/shell/ShellContext";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { ForgeStage } from "@/lib/forge-stage";
import { getStoredProcessStandard, type ProcessStandardId } from "@/lib/process-standards";
import { ROOM_HOME_COPY } from "@/lib/room-home";
import { startFromBrief } from "@/lib/start-from-brief";
import type { WorkflowTemplate, WorkflowTemplateId } from "@/lib/workflow-templates";
import nousHeroArt from "@/assets/girl_nous.png";
import steampunkGirl from "@/assets/girl_steampunk.svg";
import { ProcessStandardPicker } from "./ProcessStandardPicker";
import { PromptComposer } from "./PromptComposer";
import { TemplateCards } from "./TemplateCards";

/** Mask-friendly SVG — recolors via theme accent for all non-Nous skins. */
const defaultHeroArtUrl = typeof steampunkGirl === "string" ? steampunkGirl : steampunkGirl.src;

export type HomeHeroProps = {
  /** Which room this Home surface belongs to (copy only; seed still lands in Foundation). */
  room?: ForgeStage;
};

export function HomeHero({ room = "foundation" }: HomeHeroProps) {
  const router = useRouter();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const { openHermesConnection, refreshCurrentBusiness } = useShell();
  const { open: openChatbar } = useChatbar();
  const { showHomeProcessStandardPicker } = useDeveloperSettings();
  const { skinName } = useTheme();
  const [brief, setBrief] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<WorkflowTemplateId | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [sending, setSending] = useState(false);
  const [processStandard, setProcessStandard] = useState<ProcessStandardId>("auto");
  const copy = ROOM_HOME_COPY[room];
  const useNousHero = skinName === "nous";

  useEffect(() => {
    setProcessStandard(getStoredProcessStandard());
  }, []);

  function handleTemplateSelect(template: WorkflowTemplate) {
    setSelectedTemplateId(template.id);
    setSelectedTemplate(template);
    setBrief(template.seedPrompt);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(0, template.seedPrompt.length);
    });
  }

  function handleTemplateClear() {
    const seed = selectedTemplate?.seedPrompt?.trim() ?? "";
    setSelectedTemplateId(null);
    setSelectedTemplate(null);
    if (seed && brief.trim() === seed) {
      setBrief("");
    }
  }

  function handleBriefChange(next: string) {
    setBrief(next);
    if (selectedTemplate && next.trim() !== selectedTemplate.seedPrompt.trim()) {
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
    }
  }

  async function handleSend(text: string) {
    setSending(true);
    const templateLabel = selectedTemplate?.processName ?? null;
    try {
      await startFromBrief(text, {
        templateId: selectedTemplateId ?? undefined,
        processName: selectedTemplate?.processName,
        diagramMermaid: selectedTemplate?.diagramMermaid,
        processStandard,
      });
      setBrief("");
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
      // Refresh active business (new-business cookie) so chatbar can load the studio thread
      await refreshCurrentBusiness();
      // Land on Foundation first so page context is plant-sketch, then open chatbar
      router.push("/foundation");
      openChatbar();
      toast.success(
        templateLabel
          ? `Seeded “${templateLabel}” — Overlord is responding`
          : "Overlord is responding in chat",
        {
          action: {
            label: "Open Workshop",
            onClick: () => router.push("/workshop"),
          },
        }
      );
    } catch {
      toast.error("Could not start from your brief");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="home-page">
      <div className="home-page__stack">
        <section className="home-hero">
          <div className="home-hero__intro">
            {useNousHero ? (
              <Image
                className="home-hero__art home-hero__art--raster"
                src={nousHeroArt}
                alt=""
                width={140}
                height={140}
                priority
                aria-hidden
              />
            ) : (
              <div
                className="home-hero__art"
                aria-hidden="true"
                style={
                  {
                    "--home-hero-art-url": `url("${defaultHeroArtUrl}")`,
                  } as CSSProperties
                }
              />
            )}
            <h1 className="home-hero__title">{copy.title}</h1>
            <p className="home-hero__subtitle">{copy.subtitle}</p>
          </div>

          <PromptComposer
            value={brief}
            onChange={handleBriefChange}
            onSend={handleSend}
            sending={sending}
            onOpenConnection={openHermesConnection}
            composerRef={composerRef}
            footerExtra={
              showHomeProcessStandardPicker ? (
                <ProcessStandardPicker value={processStandard} onChange={setProcessStandard} />
              ) : null
            }
          />
        </section>

        <div className="home-page__templates">
          <TemplateCards
            selectedId={selectedTemplateId}
            onSelect={handleTemplateSelect}
            onClear={handleTemplateClear}
          />
        </div>
      </div>
    </div>
  );
}
