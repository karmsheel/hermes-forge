import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isBusinessRepoManifest,
  parseChatMessages,
  parseDocumentIndex,
  parsePersonnelFile,
  parseProcessMeta,
} from '../../lib/business-git/repo-files.ts';

describe('business-git repo-files', () => {
  it('accepts a valid manifest v1', () => {
    assert.equal(
      isBusinessRepoManifest({
        version: 1,
        businessId: 'b1',
        businessName: 'Acme',
        exportedAt: new Date().toISOString(),
        logHeadSequence: 3,
        logChecksum: 'abc',
        gitHeadCommit: null,
      }),
      true
    );
  });

  it('rejects invalid manifests', () => {
    assert.equal(isBusinessRepoManifest(null), false);
    assert.equal(isBusinessRepoManifest({ version: 2, businessId: 'x' }), false);
    assert.equal(isBusinessRepoManifest({ version: 1 }), false);
  });

  it('parses personnel.json humans and agents', () => {
    const parsed = parsePersonnelFile({
      humans: [
        { id: 'h1', name: 'Ada', role: 'Owner', isOwner: true },
        { name: '  ', role: 'Skip' },
        { name: 'Bob', role: 'Ops' },
      ],
      agents: [
        {
          id: 'a1',
          profileKey: 'hermes-default',
          displayName: 'Hermes',
          isHired: true,
          hermesHome: 'C:/hermes',
        },
        { displayName: 'No key' },
      ],
    });
    assert.equal(parsed.humans.length, 2);
    assert.equal(parsed.humans[0].isOwner, true);
    assert.equal(parsed.humans[1].name, 'Bob');
    assert.equal(parsed.agents.length, 1);
    assert.equal(parsed.agents[0].profileKey, 'hermes-default');
    assert.equal(parsed.agents[0].isHired, true);
  });

  it('parses document index entries', () => {
    const docs = parseDocumentIndex([
      { slug: 'basics', title: 'Basics', kind: 'basics', pinnedForContext: true },
      { slug: '', title: 'Bad' },
      { title: 'No slug' },
    ]);
    assert.equal(docs.length, 1);
    assert.equal(docs[0].slug, 'basics');
    assert.equal(docs[0].pinnedForContext, true);
  });

  it('parses process meta with fallbacks', () => {
    const meta = parseProcessMeta({ name: 'Invoice flow', department: 'Finance' }, 'pid1');
    assert.ok(meta);
    assert.equal(meta!.name, 'Invoice flow');
    assert.equal(meta!.department, 'Finance');
    assert.equal(meta!.status, 'mapping');

    const empty = parseProcessMeta({}, 'pid2');
    assert.ok(empty);
    assert.match(empty!.name, /Process/);
  });

  it('parses chat messages and skips invalid rows', () => {
    const messages = parseChatMessages([
      { role: 'user', content: 'Hello' },
      { role: 'system', content: 'nope' },
      { role: 'assistant', content: 'Hi' },
      { role: 'user' },
    ]);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].role, 'user');
    assert.equal(messages[1].role, 'assistant');
  });
});
