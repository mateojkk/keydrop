import { Buffer } from 'buffer';
import process from 'process';
// Meteor's SDK uses Buffer for transaction serialization in browsers.
(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
(globalThis as typeof globalThis & { process: typeof process }).process = process;
