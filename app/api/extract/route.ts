import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ExtractSchema = z.object({
  businessId: z.string(),
  baseUrl: z.string(),
  apiKey: z.string(),
  conversation: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })),
});

const EXTRACTION_PROMPT = `You are an expert Process Analyst and Automation Architect.

Given the recent conversation, extract structured business knowledge.

Return ONLY valid JSON in this exact shape (no markdown, no extra text):

{
  "business": {
    "name": string,
    "industry": string | null,
    "description": string | null,
    "teamSize": number | null,
    "goals": string | null
  },
  "processes": [
    {
      "name": string,
      "description": string,
      "department": "Sales" | "Marketing" | "Operations" | "Finance" | "Support" | "HR" | "Custom",
      "trigger": string | null,
      "inputs": string | null,
      "outputs": string | null,
      "manualSteps": string | null,
      "repetition": number | null,        // 1-10
      "businessValue": number | null,     // 1-10
      "complexity": number | null         // 1-10
    }
  ],
  "facts": string[]   // short memorable facts, max 6
}

Rules:
- Only include processes that are clearly described.
- Be conservative with scores. Higher repetition + high value + lower complexity = higher automation potential.
- If nothing new, return empty arrays.
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ExtractSchema.parse(body);

    const { businessId, baseUrl, apiKey, conversation } = parsed;

    const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'hermes-agent',
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: 'Here is the recent conversation:\n\n' + 
            conversation.map(m => `${m.role}: ${m.content}`).join('\n\n') +
            '\n\nExtract now.' }
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Hermes extraction failed' }, { status: 502 });
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || '';

    // Clean up common LLM JSON wrappers
    content = content.replace(/```json\n?|\n?```/g, '').trim();

    let extracted;
    try {
      extracted = JSON.parse(content);
    } catch {
      // Fallback: try to find JSON in text
      const match = content.match(/\{[\s\S]*\}/);
      extracted = match ? JSON.parse(match[0]) : { business: {}, processes: [], facts: [] };
    }

    let processesCreated = 0;

    // Update Business
    if (extracted.business?.name) {
      await prisma.business.update({
        where: { id: businessId },
        data: {
          name: extracted.business.name,
          industry: extracted.business.industry,
          description: extracted.business.description,
          teamSize: extracted.business.teamSize,
          goals: extracted.business.goals,
        },
      });
    }

    // Create Processes (simple dedupe by name for demo)
    if (Array.isArray(extracted.processes)) {
      for (const p of extracted.processes) {
        if (!p.name) continue;

        // Basic heuristic automation score
        const rep = p.repetition ?? 5;
        const val = p.businessValue ?? 6;
        const comp = p.complexity ?? 5;
        const score = Math.max(10, Math.min(95, Math.round((rep * 0.4 + val * 0.5 - comp * 0.3) * 6)));

        await prisma.process.create({
          data: {
            businessId,
            name: p.name,
            description: p.description || '',
            department: p.department || 'Operations',
            trigger: p.trigger || null,
            inputs: p.inputs || null,
            outputs: p.outputs || null,
            manualSteps: p.manualSteps || null,
            repetition: rep,
            businessValue: val,
            complexity: comp,
            automationScore: score,
            estimatedTimeSaved: Math.max(1, Math.round((rep + val) / 2)),
          },
        });
        processesCreated++;
      }
    }

    // Save facts as Memory
    if (Array.isArray(extracted.facts)) {
      for (const fact of extracted.facts.slice(0, 6)) {
        await prisma.memory.create({
          data: {
            businessId,
            fact,
            confidence: 0.75,
            source: 'extraction',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      processesCreated,
      extracted,
    });
  } catch (error: any) {
    console.error('Extract error', error);
    return NextResponse.json({ error: error.message || 'Extraction failed' }, { status: 500 });
  }
}
