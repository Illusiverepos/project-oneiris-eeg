'use strict';

const crypto = require('crypto');

/**
 * Project ONEIRIS — Cryptographic Target Commitment & Anti-File-Drawer Ledger
 * Supports Contemporaneous Commitment (THRESHOLD Exp 01/03/04, ATLAS, ECHO)
 * and Post-Awakening Commitment (THRESHOLD Exp 02 Temporal Access).
 */

function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input), 'utf8').digest('hex');
}

function generateNonce(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function commitTarget({ trialId, poolId, targetIndex, nonce }) {
  if (!trialId || !poolId || targetIndex === undefined || !nonce) {
    throw new Error('Missing required fields for target commitment.');
  }
  const payload = `${trialId}|${poolId}|${targetIndex}|${nonce}`;
  return {
    trialId,
    poolId,
    commitmentHash: sha256Hex(payload),
    timestampUtc: new Date().toISOString(),
  };
}

function verifyTargetReveal({ trialId, poolId, targetIndex, nonce, commitmentHash }) {
  const expected = sha256Hex(`${trialId}|${poolId}|${targetIndex}|${nonce}`);
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(String(commitmentHash), 'hex')
  );
}

function commitResponse({ trialId, audioSha256, responseIndex, psgLockSha256 }) {
  if (!trialId || !audioSha256 || responseIndex === undefined || !psgLockSha256) {
    throw new Error('Missing required fields for response commitment.');
  }
  const payload = `${trialId}|${audioSha256}|${responseIndex}|${psgLockSha256}`;
  return {
    trialId,
    responseHash: sha256Hex(payload),
    timestampUtc: new Date().toISOString(),
  };
}

/**
 * Append-only SHA-256 hash-chained ledger preventing selective trial deletion
 * (anti-file-drawer guarantee).
 */
class TrialLedger {
  constructor() {
    this.entries = [];
  }

  append(record) {
    const prevHash = this.entries.length === 0
      ? '0'.repeat(64)
      : this.entries[this.entries.length - 1].entryHash;
    const seq = this.entries.length;
    const timestampMs = record.timestampMs ?? Date.now();
    const canonical = JSON.stringify({ seq, prevHash, timestampMs, record });
    const entryHash = sha256Hex(canonical);
    const entry = { seq, prevHash, timestampMs, record, entryHash };
    this.entries.push(entry);
    return entry;
  }

  verifyIntegrity() {
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      const expectedPrev = i === 0 ? '0'.repeat(64) : this.entries[i - 1].entryHash;
      if (e.prevHash !== expectedPrev) {
        return { valid: false, failedSeq: i, reason: 'Broken prevHash link' };
      }
      const canonical = JSON.stringify({
        seq: e.seq,
        prevHash: e.prevHash,
        timestampMs: e.timestampMs,
        record: e.record,
      });
      if (sha256Hex(canonical) !== e.entryHash) {
        return { valid: false, failedSeq: i, reason: 'Entry hash mismatch (tampered payload)' };
      }
    }
    return { valid: true, count: this.entries.length };
  }

  /**
   * Verifies Exp 02 temporal ordering: Response commitment must precede
   * Target commitment by at least minDelayMs (default 60,000 ms).
   */
  verifyExp02TemporalOrder(trialId, minDelayMs = 60000) {
    const respEntry = this.entries.find(
      (e) => e.record.trialId === trialId && e.record.type === 'RESPONSE_COMMIT'
    );
    const targEntry = this.entries.find(
      (e) => e.record.trialId === trialId && e.record.type === 'TARGET_COMMIT'
    );
    if (!respEntry || !targEntry) {
      return { valid: false, reason: 'Missing RESPONSE_COMMIT or TARGET_COMMIT' };
    }
    const deltaMs = targEntry.timestampMs - respEntry.timestampMs;
    if (targEntry.seq <= respEntry.seq || deltaMs < minDelayMs) {
      return { valid: false, deltaMs, reason: `Insufficient post-response delay (${deltaMs} ms < ${minDelayMs} ms)` };
    }
    return { valid: true, deltaMs };
  }
}

module.exports = {
  sha256Hex,
  generateNonce,
  commitTarget,
  verifyTargetReveal,
  commitResponse,
  TrialLedger,
};
