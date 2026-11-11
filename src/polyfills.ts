import { Buffer } from 'buffer';
// Meteor's SDK uses Buffer for transaction serialization in browsers.
(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
