/**
 * OCR Preprocessor
 * In production, this would use OpenCV for:
 * - Deskew
 * - Denoise
 * - Threshold
 * - 300dpi conversion
 *
 * For the initial implementation, Document AI handles most preprocessing internally.
 * This module provides the interface for future OpenCV integration.
 */

export interface PreprocessOptions {
  deskew: boolean;
  denoise: boolean;
  threshold: boolean;
  targetDpi: number;
}

const defaultOptions: PreprocessOptions = {
  deskew: true,
  denoise: true,
  threshold: true,
  targetDpi: 300,
};

export async function preprocessDocument(
  fileBuffer: Buffer,
  options: PreprocessOptions = defaultOptions
): Promise<Buffer> {
  // Document AI handles preprocessing internally for most cases.
  // For images that need explicit preprocessing, we would use sharp here.
  // For now, pass through the buffer as-is.
  // Future: integrate OpenCV via sharp or a native module.

  if (options.targetDpi !== 300) {
    // Use sharp for DPI conversion if needed
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(fileBuffer).metadata();
    if (metadata.density && metadata.density < options.targetDpi) {
      return await sharp(fileBuffer)
        .withMetadata({ density: options.targetDpi })
        .toBuffer();
    }
  }

  return fileBuffer;
}
