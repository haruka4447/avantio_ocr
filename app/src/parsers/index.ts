import type { DocumentType, DocumentParser } from '../models/types';
import { RegistryParser } from './registryParser';
import { ContractParser } from './contractParser';
import { DrawingParser } from './drawingParser';
import { HazardParser } from './hazardParser';
import { PermitParser } from './permitParser';

const parserMap: Record<string, () => DocumentParser> = {
  registry: () => new RegistryParser(),
  contract: () => new ContractParser(),
  drawing: () => new DrawingParser(),
  hazard: () => new HazardParser(),
  permit: () => new PermitParser(),
};

export function getParser(documentType: DocumentType): DocumentParser {
  const factory = parserMap[documentType];
  if (!factory) {
    throw new Error(`No parser available for document type: ${documentType}`);
  }
  return factory();
}

export { RegistryParser } from './registryParser';
export { ContractParser } from './contractParser';
export { DrawingParser } from './drawingParser';
export { HazardParser } from './hazardParser';
export { PermitParser } from './permitParser';
