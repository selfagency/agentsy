import { type ContentKind, type ContentRoute, routeCompressionStrategy } from '../strategies/content-router.js';

import type { OutputCompressionDetailedResult, OutputCompressionOptions } from './output-compressor.js';
import { compressOutputDetailed } from './output-compressor.js';

export interface OutputCompressionV2Result extends OutputCompressionDetailedResult {
  contentKind: ContentKind;
  route: ContentRoute;
}

export function compressOutputV2(input: string, options: OutputCompressionOptions = {}): OutputCompressionV2Result {
  const route = routeCompressionStrategy([{ content: input }]);
  const result = compressOutputDetailed(input, options);

  return {
    ...result,
    contentKind: route.kind,
    route
  };
}
