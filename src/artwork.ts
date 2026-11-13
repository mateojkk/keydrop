// Small artwork can live in immutable on-chain metadata without a pinning service.
export async function encodeArtwork(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    for (const size of [320, 256, 192, 128, 96]) {
      const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context)
        throw new Error('Image processing is unavailable in this browser. Use a public image URL.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.62, 0.42]) {
        const data = canvas.toDataURL('image/webp', quality);
        if (data.length <= 6000) return data;
      }
    }
    throw new Error(
      'This image is too detailed for on-chain storage. Use its public HTTPS or IPFS URL instead.',
    );
  } finally {
    bitmap.close();
  }
}
