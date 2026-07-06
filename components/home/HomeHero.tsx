"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const { openNewProject, openHermesConnection } = useShell();
  const [brief, setBrief] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<WorkflowTemplateId | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [sending, setSending] = useState(false);
  const [processStandard, setProcessStandard] = useState<ProcessStandardId>("auto");

  useEffect(() => {
    setProcessStandard(getStoredProcessStandard());
  }, []);

  function handleTemplateSelect(template: WorkflowTemplate) {
    if (template.id === "blank") {
      setSelectedTemplateId(null);
      setSelectedTemplate(null);
      setBrief("");
      openNewProject();
      return;
    }

    setSelectedTemplateId(template.id);
    setSelectedTemplate(template);
    setBrief(template.seedPrompt);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(0, template.seedPrompt.length);
    });
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
      router.push("/workshop");
    } catch {
      toast.error("Could not start from your brief");
    } finally {
      setSending(false);
    }
  }

  return (
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
        <p className="home-hero__subtitle">Map, monitor and automate your business with Hermes Agent</p>
      </div>

      <PromptComposer
        value={brief}
        onChange={handleBriefChange}
        onSend={handleSend}
        sending={sending}
        onOpenConnection={openHermesConnection}
        composerRef={composerRef}
        footerExtra={
          <ProcessStandardPicker value={processStandard} onChange={setProcessStandard} />
        }
      />

      <TemplateCards selectedId={selectedTemplateId} onSelect={handleTemplateSelect} />

      <p className="home-hero__blank">
        <button type="button" onClick={openNewProject} className="home-hero__blank-link">
          …or start a blank business ›
        </button>
      </p>
    </section>
  );
}