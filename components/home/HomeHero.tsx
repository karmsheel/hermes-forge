"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDeveloperSettings } from "@/components/settings/DeveloperSettingsProvider";
import { useShell } from "@/components/shell/ShellContext";
import { getStoredProcessStandard, type ProcessStandardId } from "@/lib/process-standards";
import { startFromBrief } from "@/lib/start-from-brief";
import type { WorkflowTemplate, WorkflowTemplateId } from "@/lib/workflow-templates";
import steampunkGirl from "@/assets/girl_steampunk.svg";
import { ProcessStandardPicker } from "./ProcessStandardPicker";
import { PromptComposer } from "./PromptComposer";
import { TemplateCards } from "./TemplateCards";

const heroArtUrl = typeof steampunkGirl === "string" ? steampunkGirl : steampunkGirl.src;

export function HomeHero() {
  const router = useRouter();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const { openHermesConnection } = useShell();
  const { showHomeProcessStandardPicker } = useDeveloperSettings();
  const [brief, setBrief] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<WorkflowTemplateId | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [sending, setSending] = useState(false);
  const [processStandard, setProcessStandard] = useState<ProcessStandardId>("auto");

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
      // Foundation first; activeProcessId + pending reply enable Workshop deep-link
      toast.success(
        templateLabel
          ? `Seeded “${templateLabel}” in Foundation`
          : "Draft ready in Foundation",
        {
          action: {
            label: "Open Workshop",
            onClick: () => router.push("/workshop"),
          },
        }
      );
      router.push("/foundation");
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
            <div
              className="home-hero__art"
              aria-hidden="true"
              style={
                {
                  "--home-hero-art-url": `url(${heroArtUrl})`,
                } as CSSProperties
              }
            />
            <h1 className="home-hero__title">What will you FORGE today?</h1>
            <p className="home-hero__subtitle">
              Start in Foundation with Overlord — sketch the plant, then map and forge
            </p>
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