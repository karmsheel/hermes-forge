import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canForgeProcess,
  isProcessForged,
  normalizeProcessStatus,
} from '../../lib/process-status.ts';
import { isForgedLifecycle } from '../../lib/lifecycle.ts';

describe('process lifecycle (4.12)', () => {
  it('normalizes legacy statuses', () => {
    assert.equal(normalizeProcessStatus('mapping'), 'draft');
    assert.equal(normalizeProcessStatus('reviewed'), 'refined');
    assert.equal(normalizeProcessStatus('approved'), 'forged');
    assert.equal(normalizeProcessStatus('forged'), 'forged');
  });

  it('detects forged', () => {
    assert.equal(isProcessForged('forged'), true);
    assert.equal(isProcessForged('approved'), true);
    assert.equal(isProcessForged('draft'), false);
  });

  it('can forge only with diagram and not already forged', () => {
    assert.equal(
      canForgeProcess({ status: 'draft', diagramMermaid: 'flowchart TD\nA-->B' }),
      true
    );
    assert.equal(canForgeProcess({ status: 'draft', diagramMermaid: null }), false);
    assert.equal(
      canForgeProcess({ status: 'forged', diagramMermaid: 'x' }),
      false
    );
  });

  it('document forged helper', () => {
    assert.equal(isForgedLifecycle('forged'), true);
    assert.equal(isForgedLifecycle('approved'), true);
    assert.equal(isForgedLifecycle('draft'), false);
  });
});
