import JSZip from 'jszip';

/**
 * Diagonal line definition: draws a line from bottom-left to top-right
 * across the specified row range (indicating "not applicable").
 */
export interface DiagonalLine {
  fromRow: number;   // 0-based start row
  toRow: number;     // 0-based end row
  fromCol: number;   // 0-based start column (default 0)
  toCol: number;     // 0-based end column (default 26 = Z)
}

/**
 * Predefined diagonal line definitions that can be conditionally applied.
 * Key = identifier, value = line definition.
 */
export const DIAGONAL_LINES: Record<string, DiagonalLine> = {
  // 3. 登記 — 土地 乙区 (rows 131-137, 0-based: 130-136)
  registry_land_otsu: { fromRow: 130, toRow: 136, fromCol: 2, toCol: 26 },
  // 3. 登記 — 建物 甲区/乙区 (rows 141-147, 0-based: 140-146)
  registry_building: { fromRow: 140, toRow: 146, fromCol: 3, toCol: 26 },
  // 4. 市街化調整区域 (rows 157-161, 0-based: 156-160)
  urbanization_control: { fromRow: 156, toRow: 160, fromCol: 5, toCol: 26 },
  // 4. 開発行為の許可 (rows 161-166, 0-based: 160-165)
  development_permit: { fromRow: 160, toRow: 165, fromCol: 5, toCol: 26 },
  // 4. 土地区画整理 備考 (rows 177-185, 0-based: 176-184)
  land_readjustment_note: { fromRow: 176, toRow: 184, fromCol: 1, toCol: 26 },
  // 4. その他の建築制限 (rows 237-240, 0-based: 236-239)
  other_building_restriction: { fromRow: 236, toRow: 239, fromCol: 5, toCol: 26 },
  // 4. 条例等による制限 (rows 245-248, 0-based: 244-247)
  ordinance_restriction: { fromRow: 244, toRow: 247, fromCol: 6, toCol: 26 },
  // 6. 私道 備考 (rows 366-372, 0-based: 365-371)
  private_road_note: { fromRow: 365, toRow: 371, fromCol: 0, toCol: 26 },
  // 10. アスベスト (rows 414-424, 0-based: 413-423)
  asbestos: { fromRow: 413, toRow: 423, fromCol: 4, toCol: 26 },
  // 11. 耐震診断の内容 (rows 427-433, 0-based: 426-432)
  seismic: { fromRow: 426, toRow: 432, fromCol: 9, toCol: 26 },
  // 14. 契約解除 備考 (rows 474-482, 0-based: 473-481)
  cancellation_note: { fromRow: 473, toRow: 481, fromCol: 3, toCol: 26 },
  // 16. 金銭貸借 追加行 (rows 504-512, 0-based: 503-511)
  loan_extra: { fromRow: 503, toRow: 511, fromCol: 0, toCol: 26 },
  // 17. 割賦販売 (rows 527-535, 0-based: 526-534)
  installment: { fromRow: 526, toRow: 534, fromCol: 7, toCol: 26 },
  // 18. 土地測量清算 (rows 538-544, 0-based: 537-543)
  land_survey: { fromRow: 537, toRow: 543, fromCol: 0, toCol: 26 },
  // 22. 長期使用製品 (rows 594-605, 0-based: 593-604)
  long_term_product: { fromRow: 593, toRow: 604, fromCol: 0, toCol: 26 },
  // 23. 支払金保全 (rows 610-616, 0-based: 609-615)
  payment_protection: { fromRow: 609, toRow: 615, fromCol: 6, toCol: 26 },
};

/**
 * Generate drawing XML containing diagonal lines.
 */
function generateDrawingXml(lines: DiagonalLine[]): string {
  let shapes = '';
  let id = 2;

  for (const line of lines) {
    shapes += `<xdr:twoCellAnchor>` +
      `<xdr:from><xdr:col>${line.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff>` +
      `<xdr:row>${line.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
      `<xdr:to><xdr:col>${line.toCol}</xdr:col><xdr:colOff>0</xdr:colOff>` +
      `<xdr:row>${line.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
      `<xdr:cxnSp macro="">` +
      `<xdr:nvCxnSpPr><xdr:cNvPr id="${id}" name="Line ${id - 1}"/>` +
      `<xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>` +
      `<xdr:spPr>` +
      `<a:xfrm flipV="1"><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm>` +
      `<a:prstGeom prst="line"><a:avLst/></a:prstGeom>` +
      `<a:ln w="6350" cmpd="sng"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>` +
      `</xdr:spPr>` +
      `<xdr:style>` +
      `<a:lnRef idx="2"><a:schemeClr val="accent1"/></a:lnRef>` +
      `<a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef>` +
      `<a:effectRef idx="1"><a:schemeClr val="accent1"/></a:effectRef>` +
      `<a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef>` +
      `</xdr:style>` +
      `</xdr:cxnSp><xdr:clientData/></xdr:twoCellAnchor>`;
    id++;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    shapes +
    `</xdr:wsDr>`;
}

/**
 * Inject diagonal line drawings into an xlsx buffer.
 * ExcelJS doesn't support drawings, so we manipulate the zip directly.
 */
export async function addDiagonalLines(
  xlsxBuffer: Buffer,
  lineKeys: string[]
): Promise<Buffer> {
  const lines = lineKeys
    .map(key => DIAGONAL_LINES[key])
    .filter(Boolean);

  if (lines.length === 0) return xlsxBuffer;

  const zip = await JSZip.loadAsync(xlsxBuffer);

  // 1. Add drawing XML
  const drawingXml = generateDrawingXml(lines);
  zip.file('xl/drawings/drawing1.xml', drawingXml);

  // 2. Add/update worksheet rels to reference the drawing
  const relsPath = 'xl/worksheets/_rels/sheet1.xml.rels';
  let relsXml = '';
  const existingRels = zip.file(relsPath);
  if (existingRels) {
    const existing = await existingRels.async('string');
    // Add drawing relationship if not present
    if (!existing.includes('relationships/drawing')) {
      relsXml = existing.replace(
        '</Relationships>',
        `<Relationship Id="rId_drawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`
      );
    } else {
      relsXml = existing;
    }
  } else {
    relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId_drawing" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>` +
      `</Relationships>`;
  }
  zip.file(relsPath, relsXml);

  // 3. Add drawing reference to the worksheet XML
  const sheetPath = 'xl/worksheets/sheet1.xml';
  const sheetFile = zip.file(sheetPath);
  if (sheetFile) {
    let sheetXml = await sheetFile.async('string');
    if (!sheetXml.includes('<drawing')) {
      // Insert <drawing> before </worksheet>
      sheetXml = sheetXml.replace(
        '</worksheet>',
        `<drawing r:id="rId_drawing"/></worksheet>`
      );
      // Ensure r namespace is declared
      if (!sheetXml.includes('xmlns:r=')) {
        sheetXml = sheetXml.replace(
          '<worksheet',
          '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
        );
      }
      zip.file(sheetPath, sheetXml);
    }
  }

  // 4. Update [Content_Types].xml to include drawing content type
  const ctPath = '[Content_Types].xml';
  const ctFile = zip.file(ctPath);
  if (ctFile) {
    let ctXml = await ctFile.async('string');
    if (!ctXml.includes('drawing+xml')) {
      ctXml = ctXml.replace(
        '</Types>',
        `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`
      );
      zip.file(ctPath, ctXml);
    }
  }

  const result = await zip.generateAsync({ type: 'nodebuffer' });
  return Buffer.from(result) as Buffer;
}
