// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

/**
 * PDFがテキストレイヤーを持つか判定する
 * 先頭3ページで100文字以上のテキストがあればテキストPDFと判断
 */
export async function isTextPdf(pdfBuffer: Buffer): Promise<boolean> {
  try {
    const data = await pdfParse(pdfBuffer, { max: 3 })
    return data.text.length > 100
  } catch {
    return false
  }
}

/**
 * テキストPDFから全ページのテキストを抽出する
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  const data = await pdfParse(pdfBuffer)
  return data.text
}
