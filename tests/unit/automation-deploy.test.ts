import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCronPrompt } from '../../lib/automation-deploy.ts';
import type { AutomationPlan } from '../../lib/automation-types.ts';

const plan: AutomationPlan = {
  summary: 'Send daily sales digest',
  recommendedPath: 'hermes_cron',
  triggerType: 'schedule',
  schedule: 'every 1d at 09:00',
  automatableSteps: ['Pull CRM deals', 'Summarize pipeline'],
  manualSteps: ['Approve pricing exceptions'],
};

describe('buildCronPrompt agent bind', () => {
  it('includes process goal without agent when none assigned', () => {
    const prompt = buildCronPrompt(
      {
        name: 'Sales digest',
        description: 'Daily pipeline update',
        trigger: 'Morning',
        manualSteps: null,
        diagramMermaid: null,
      },
      plan,
      null
    );
    assert.match(prompt, /Sales digest/);
    assert.match(prompt, /Send daily sales digest/);
    assert.match(prompt, /Content inventory/);
    assert.doesNotMatch(prompt, /hired Hermes agent/);
  });

  it('injects hired agent identity into cron prompt', () => {
    const prompt = buildCronPrompt(
      {
        name: 'Sales digest',
        description: 'Daily pipeline update',
        trigger: 'Morning',
        manualSteps: null,
        diagramMermaid: 'flowchart TD\n  A-->B',
      },
      plan,
      {
        id: 'agent1',
        displayName: 'Ops Hermes',
        profileKey: 'ops',
        description: 'Operations specialist',
        model: 'gpt-test',
        isHired: true,
        isDefault: true,
        iconKey: null,
      }
    );
    assert.match(prompt, /Ops Hermes/);
    assert.match(prompt, /profile: ops/);
    assert.match(prompt, /Operations specialist/);
    assert.match(prompt, /Preferred model: gpt-test/);
    assert.match(prompt, /flowchart TD/);
  });

  it('embeds content ingest callback when options provided', () => {
    const prompt = buildCronPrompt(
      {
        name: 'Content cycle',
        description: 'Weekly drafts',
        trigger: 'Monday',
        manualSteps: null,
        diagramMermaid: null,
      },
      plan,
      {
        id: 'agent1',
        displayName: 'Writer',
        profileKey: 'writer',
        description: null,
        model: null,
        isHired: true,
        isDefault: false,
        iconKey: null,
      },
      {
        forgeBaseUrl: 'http://127.0.0.1:3847',
        ingestToken: 'forge-ingest-test-token',
      }
    );
    assert.match(prompt, /Content handoff/);
    assert.match(prompt, /http:\/\/127\.0\.0\.1:3847\/api\/content\/ingest/);
    assert.match(prompt, /Authorization: Bearer forge-ingest-test-token/);
    assert.match(prompt, /"status": "review"/);
  });
});
