// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

/**
 * Check if a PDF has an embedded text layer (digital PDF vs scanned image).
 * Returns the extracted text if digital, or null if scanned/image-based.
 */
export async function extractDigitalPdfText(
  buffer: Buffer
): Promise<{ isDigital: boolean; text: string; pages: string[] }> {
  try {
    const data = await pdfParse(buffer);

    // If text is very short relative to page count, it's likely a scanned PDF
    const textPerPage = data.text.length / (data.numpages || 1);
    const isDigital = textPerPage > 50; // At least 50 chars per page

    if (!isDigital) {
      return { isDigital: false, text: '', pages: [] };
    }

    const fullText: string = data.text;

    // Split by form feed character if present
    let pages: string[];
    if (fullText.includes('\f')) {
      pages = fullText.split('\f').filter((p: string) => p.trim().length > 0);
    } else {
      pages = [fullText];
    }

    return { isDigital: true, text: fullText, pages };
  } catch {
    return { isDigital: false, text: '', pages: [] };
  }
}
