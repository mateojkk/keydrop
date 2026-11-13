import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const wasm = readFileSync(new URL('../artifacts/keydrop-global.wasm', import.meta.url));
const factory = readFileSync(new URL('../factory/src/lib.rs', import.meta.url), 'utf8');
const hashBytes = factory
  .match(/const CHILD_CODE_HASH: \[u8; 32\] = \[([^]*?)\];/)?.[1]
  .match(/0x[0-9a-f]{2}/gi)
  ?.map((value) => Number.parseInt(value.slice(2), 16));
assert.equal(hashBytes?.length, 32, 'Factory must pin a 32-byte global code hash');
const actual = createHash('sha256').update(wasm).digest('hex');
const expected = Buffer.from(hashBytes).toString('hex');
assert.equal(actual, expected, 'Pinned global WASM does not match factory code hash');
console.log(`Global child code verified: ${actual} (${wasm.length} bytes)`);
