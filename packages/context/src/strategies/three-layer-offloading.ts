import { type ContentRoute, routeCompressionStrategy } from './content-router.js';

export interface ThreeLayerOffloadResult {
  inputLayer: ContentRoute;
  messageLayer: ContentRoute;
  resultLayer: ContentRoute;
}

export function createThreeLayerOffloading<TInput, TMessage, TResult>(
  input: TInput,
  messages: readonly TMessage[],
  result: TResult
): ThreeLayerOffloadResult {
  return {
    inputLayer: routeCompressionStrategy([{ content: input }]),
    messageLayer: routeCompressionStrategy(messages as readonly unknown[]),
    resultLayer: routeCompressionStrategy([{ content: result }])
  };
}
