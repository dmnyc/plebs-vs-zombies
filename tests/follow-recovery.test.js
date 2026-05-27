import { describe, it, expect } from 'vitest';
import {
  rankFollowListCandidates,
  pickRecommendedRecovery,
} from '../src/lib/followRecovery.js';

function makeCandidate(id, createdAt, followPubkeys) {
  return {
    event: {
      id,
      pubkey: 'author',
      kind: 3,
      created_at: createdAt,
      tags: followPubkeys.map((p) => ['p', p]),
      content: '',
      sig: 'sig',
    },
    eventId: id,
    createdAt,
    followCount: followPubkeys.length,
    followPubkeys,
    foundOnRelays: [],
    isCurrent: false,
    isRecommended: false,
  };
}

describe('rankFollowListCandidates', () => {
  it('sorts by follow count descending', () => {
    const c1 = makeCandidate('a', 1000, ['x', 'y']);
    const c2 = makeCandidate('b', 1000, ['x', 'y', 'z', 'w']);
    const c3 = makeCandidate('c', 1000, ['x']);

    const ranked = rankFollowListCandidates([c1, c2, c3]);
    expect(ranked.map((c) => c.eventId)).toEqual(['b', 'a', 'c']);
  });

  it('breaks follow-count ties with most-recent created_at', () => {
    const older = makeCandidate('older', 1000, ['x', 'y', 'z']);
    const newer = makeCandidate('newer', 2000, ['x', 'y', 'z']);
    const oldest = makeCandidate('oldest', 500, ['x', 'y', 'z']);

    const ranked = rankFollowListCandidates([older, newer, oldest]);
    expect(ranked.map((c) => c.eventId)).toEqual(['newer', 'older', 'oldest']);
  });

  it('ranks largest first even when an older version is bigger than a newer wipe', () => {
    const wipe = makeCandidate('wipe', 5000, []);
    const big = makeCandidate('big', 3000, ['a', 'b', 'c', 'd', 'e']);
    const small = makeCandidate('small', 4000, ['a', 'b']);

    const ranked = rankFollowListCandidates([wipe, big, small]);
    expect(ranked[0].eventId).toBe('big');
  });
});

describe('pickRecommendedRecovery', () => {
  it('returns null when current is already the largest', () => {
    const current = makeCandidate('c', 5000, ['a', 'b', 'c', 'd']);
    const older = makeCandidate('o', 3000, ['a', 'b']);
    const recommendation = pickRecommendedRecovery([current, older], current);
    expect(recommendation).toBeNull();
  });

  it('recommends a strictly larger older version when current is a wipe', () => {
    const wipe = makeCandidate('wipe', 5000, []);
    const big = makeCandidate('big', 3000, ['a', 'b', 'c', 'd', 'e']);
    const recommendation = pickRecommendedRecovery([wipe, big], wipe);
    expect(recommendation?.eventId).toBe('big');
  });

  it('does not recommend the current event itself', () => {
    const current = makeCandidate('c', 5000, ['a', 'b', 'c']);
    const recommendation = pickRecommendedRecovery([current], current);
    expect(recommendation).toBeNull();
  });

  it('filters tombstones (zero follows) out of recommendations', () => {
    const current = makeCandidate('c', 5000, ['a']);
    const tombstone = makeCandidate('t', 4000, []);
    const recommendation = pickRecommendedRecovery([current, tombstone], current);
    expect(recommendation).toBeNull();
  });

  it('recommends the most-recent of multiple tied-largest candidates', () => {
    const wipe = makeCandidate('wipe', 9000, []);
    const olderBig = makeCandidate('older', 3000, ['a', 'b', 'c']);
    const newerBig = makeCandidate('newer', 4000, ['x', 'y', 'z']);
    const recommendation = pickRecommendedRecovery(
      [wipe, olderBig, newerBig],
      wipe,
    );
    expect(recommendation?.eventId).toBe('newer');
  });

  it('recommends the largest non-empty when no current event exists', () => {
    const a = makeCandidate('a', 3000, ['x']);
    const b = makeCandidate('b', 4000, ['x', 'y', 'z']);
    const recommendation = pickRecommendedRecovery([a, b], null);
    expect(recommendation?.eventId).toBe('b');
  });
});
