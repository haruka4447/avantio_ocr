export {
  createProperty,
  getProperty,
  listProperties,
  mergePropertyData,
  updatePropertyStatus,
  deleteProperty,
} from './propertyService';

export {
  createDocument,
  getDocument,
  listDocuments,
  updateOcrResult,
  updateParsedData,
  uploadFile,
  downloadFile,
  deleteDocument,
} from './documentService';

export {
  hashPdf,
  getCachedOcr,
  setCachedOcr,
} from './ocrCache';
