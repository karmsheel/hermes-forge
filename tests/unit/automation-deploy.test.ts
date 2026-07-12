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
});
