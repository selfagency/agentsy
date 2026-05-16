import { expect, expectTypeOf, test } from "vitest";

import {
  ItemDoneStreaming,
  isStreamingDone,
  markStreamingDone,
} from "./types.js";
import type { DeepPartial, StreamingPartial } from "./types.js";

test("DeepPartial preserves nested array partials", () => {
  interface Input {
    items: {
      id: string;
      nested: {
        enabled: boolean;
      };
    }[];
  }

  const partial: DeepPartial<Input> = {
    items: [
      {
        nested: {},
      },
    ],
  };

  expectTypeOf(partial.items?.[0]?.id).toEqualTypeOf<string | undefined>();
  expectTypeOf(partial.items?.[0]?.nested).toMatchTypeOf<
    | {
        enabled?: boolean;
      }
    | undefined
  >();
});

test("streaming completion marker is preserved", () => {
  const partial: StreamingPartial<{ value: string }> = {};

  expect(isStreamingDone(partial)).toBeFalsy();

  const done = markStreamingDone(partial);
  expect(isStreamingDone(done)).toBeTruthy();
  expect(Object.hasOwn(done, ItemDoneStreaming)).toBeTruthy();
});
