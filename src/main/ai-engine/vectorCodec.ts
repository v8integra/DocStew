/**
 * Converts between Float32Array and a Buffer for SQLite BLOB storage.
 *
 * Deliberately uses DataView rather than casting `buffer.buffer` directly
 * into a Float32Array view: a Buffer read back from better-sqlite3 (or any
 * small Buffer, which Node pools internally) isn't guaranteed to start at a
 * 4-byte-aligned offset within its underlying ArrayBuffer, and constructing
 * a Float32Array at a misaligned byteOffset throws a RangeError. DataView has
 * no such alignment requirement, so this is correct regardless of Buffer
 * pooling — at the cost of a per-element loop instead of a zero-copy view,
 * which is negligible at embedding-vector sizes (hundreds of floats).
 */
export function vectorToBuffer(vector: Float32Array): Buffer {
  const buf = Buffer.alloc(vector.length * 4);
  for (let i = 0; i < vector.length; i++) {
    buf.writeFloatLE(vector[i], i * 4);
  }
  return buf;
}

export function bufferToVector(buf: Buffer): Float32Array {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = new Float32Array(buf.byteLength / 4);
  for (let i = 0; i < out.length; i++) {
    out[i] = view.getFloat32(i * 4, true);
  }
  return out;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
