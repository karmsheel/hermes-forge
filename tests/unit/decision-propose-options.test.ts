import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultChangeOptions } from '../../lib/decisions/propose.ts';

describe('defaultChangeOptions', () => {
  it('includes approve, reject, and redirect', () => {
    const opts = defaultChangeOptions();
    assert.equal(opts.length, 3);
    assert.ok(opts.some((o) => o.kind === 'approve' && o.primary));
    assert.ok(opts.some((o) => o.kind === 'reject'));
    assert.ok(opts.some((o) => o.kind === 'redirect'));
  });
});
