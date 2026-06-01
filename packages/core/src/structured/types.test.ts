import { expect, expectTypeOf, test } from 'vitest';

import {
  ItemDoneStreaming,
  isStreamingDone,
  markStreamingDone,
  type DeepPartial,
  type StreamingPartial
} from './types.js';

test('DeepPartial preserves nested array partials', () => {
  type Input = {
    items: Array<{
      id: string;
      nested: {
        enabled: boolean;
      };
    }>;
  };

  const partial: DeepPartial<Input> = {
    items: [
      {
        nested: {}
      }
    ]
  };

  expectTypeOf(partial.items?.[0]?.id).toEqualTypeOf<string | undefined>();
  expectTypeOf(partial.items?.[0]?.nested).toMatchTypeOf<
    | {
        enabled?: boolean;
      }
    | undefined
  >();
});

test('streaming completion marker is preserved', () => {
  const partial: StreamingPartial<{ value: string }> = {};

  expect(isStreamingDone(partial)).toBe(false);

  const done = markStreamingDone(partial);
  expect(isStreamingDone(done)).toBe(true);
  expect(Object.hasOwn(done, ItemDoneStreaming)).toBe(true);
});
