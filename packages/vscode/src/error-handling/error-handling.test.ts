import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  expectTypeOf,
} from "vitest";

import { ProviderErrorCode } from "../types/errors.js";
import {
  createProviderError,
  errorCodeToMessage,
  errorToProviderCode,
  httpStatusToErrorCode,
} from "./error-mapper.js";
import {
  calculateRetryDelay,
  isRetryableError,
  withRetry,
} from "./error-recovery.js";

describe("error-mapper", () => {
  describe(httpStatusToErrorCode, () => {
    it("maps 401 to InvalidApiKey", () => {
      expect(httpStatusToErrorCode(401)).toBe(ProviderErrorCode.InvalidApiKey);
    });

    it("maps 403 to InvalidApiKey", () => {
      expect(httpStatusToErrorCode(403)).toBe(ProviderErrorCode.InvalidApiKey);
    });

    it("maps 429 to RateLimited", () => {
      expect(httpStatusToErrorCode(429)).toBe(ProviderErrorCode.RateLimited);
    });

    it("maps 404 to ModelNotFound", () => {
      expect(httpStatusToErrorCode(404)).toBe(ProviderErrorCode.ModelNotFound);
    });

    it("maps 408 to Timeout", () => {
      expect(httpStatusToErrorCode(408)).toBe(ProviderErrorCode.Timeout);
    });

    it("maps 504 to Timeout", () => {
      expect(httpStatusToErrorCode(504)).toBe(ProviderErrorCode.Timeout);
    });

    it("maps 400 to InvalidRequest", () => {
      expect(httpStatusToErrorCode(400)).toBe(ProviderErrorCode.InvalidRequest);
    });

    it("maps 500+ to InternalError", () => {
      expect(httpStatusToErrorCode(500)).toBe(ProviderErrorCode.InternalError);
      expect(httpStatusToErrorCode(503)).toBe(ProviderErrorCode.InternalError);
    });

    it("maps unknown status to InternalError", () => {
      expect(httpStatusToErrorCode(999)).toBe(ProviderErrorCode.InternalError);
    });
  });

  describe(errorToProviderCode, () => {
    it("returns InternalError for null", () => {
      expect(errorToProviderCode(null)).toBe(ProviderErrorCode.InternalError);
    });

    it("uses status property if present", () => {
      expect(errorToProviderCode({ status: 429 })).toBe(
        ProviderErrorCode.RateLimited
      );
    });

    it("detects invalid api key from message", () => {
      expect(errorToProviderCode(new Error("Invalid API key provided"))).toBe(
        ProviderErrorCode.InvalidApiKey
      );
    });

    it("detects rate limit from message", () => {
      expect(errorToProviderCode(new Error("rate limit exceeded"))).toBe(
        ProviderErrorCode.RateLimited
      );
    });

    it("detects model not found from message", () => {
      expect(errorToProviderCode(new Error("model not found: gpt-9"))).toBe(
        ProviderErrorCode.ModelNotFound
      );
    });

    it("detects context length exceeded", () => {
      expect(errorToProviderCode(new Error("context length exceeded"))).toBe(
        ProviderErrorCode.ContextLengthExceeded
      );
    });

    it("detects connection error", () => {
      expect(errorToProviderCode(new Error("ECONNREFUSED"))).toBe(
        ProviderErrorCode.ConnectionError
      );
    });

    it("detects timeout from message", () => {
      expect(errorToProviderCode(new Error("request timed out"))).toBe(
        ProviderErrorCode.Timeout
      );
    });

    it("detects cancelled", () => {
      expect(errorToProviderCode(new Error("request was aborted"))).toBe(
        ProviderErrorCode.Cancelled
      );
    });

    it("returns InternalError for unrecognized errors", () => {
      expect(errorToProviderCode(new Error("something weird happened"))).toBe(
        ProviderErrorCode.InternalError
      );
    });
  });

  describe(errorCodeToMessage, () => {
    it("returns a non-empty message for each error code", () => {
      for (const code of Object.values(ProviderErrorCode)) {
        const msg = errorCodeToMessage(code as ProviderErrorCode);
        expectTypeOf(msg).toBeString();
        expect(msg.length).toBeGreaterThan(0);
      }
    });
  });

  describe(createProviderError, () => {
    it("creates an Error with the mapped message", () => {
      const err = createProviderError(ProviderErrorCode.InvalidApiKey);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe(
        `ProviderError[${ProviderErrorCode.InvalidApiKey}]`
      );
    });

    it("attaches original error as cause", () => {
      const original = new Error("original");
      const err = createProviderError(ProviderErrorCode.Timeout, original);
      expect(err.cause).toBe(original);
    });

    it("handles non-Error original values gracefully", () => {
      const err = createProviderError(
        ProviderErrorCode.InternalError,
        "string error"
      );
      expect(err).toBeInstanceOf(Error);
    });

    it("can preserve original message content", () => {
      const err = createProviderError(
        ProviderErrorCode.Timeout,
        new Error("socket timed out"),
        {
          preserveOriginalMessage: true,
        }
      );

      expect(err.message).toContain("socket timed out");
      expect(err.message).toContain("Request timed out");
    });

    it("can attach provider code metadata and message prefix", () => {
      const err = createProviderError(
        ProviderErrorCode.InvalidRequest,
        undefined,
        { attachCode: true }
      ) as Error & {
        code?: ProviderErrorCode;
      };

      expect(
        err.message.startsWith(`[${ProviderErrorCode.InvalidRequest}]`)
      ).toBeTruthy();
      expect(err.code).toBe(ProviderErrorCode.InvalidRequest);
    });
  });
});

describe("error-recovery", () => {
  describe(isRetryableError, () => {
    it("RateLimited is retryable", () => {
      expect(isRetryableError(new Error("rate limit exceeded"))).toBeTruthy();
    });

    it("Timeout is retryable", () => {
      expect(isRetryableError(new Error("request timed out"))).toBeTruthy();
    });

    it("ConnectionError is retryable", () => {
      expect(isRetryableError(new Error("ECONNREFUSED"))).toBeTruthy();
    });

    it("InternalError is retryable", () => {
      expect(isRetryableError(new Error("unknown error"))).toBeTruthy();
    });

    it("InvalidApiKey is not retryable", () => {
      expect(isRetryableError(new Error("Invalid API key"))).toBeFalsy();
    });

    it("ModelNotFound is not retryable", () => {
      expect(isRetryableError(new Error("model not found"))).toBeFalsy();
    });

    it("InvalidRequest is not retryable", () => {
      expect(isRetryableError(new Error("bad request"))).toBeFalsy();
    });
  });

  describe(calculateRetryDelay, () => {
    const opts = {
      backoffMultiplier: 2,
      initialDelayMs: 1000,
      maxDelayMs: 30_000,
    };

    it("returns initialDelayMs for attempt 0", () => {
      expect(calculateRetryDelay(0, opts)).toBe(1000);
    });

    it("doubles for attempt 1", () => {
      expect(calculateRetryDelay(1, opts)).toBe(2000);
    });

    it("does not exceed maxDelayMs", () => {
      expect(calculateRetryDelay(100, opts)).toBe(30_000);
    });
  });

  describe(withRetry, () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns value immediately on success", async () => {
      const op = vi.fn().mockResolvedValue("ok");
      const result = await withRetry(op, { initialDelayMs: 0, maxAttempts: 3 });
      expect(result).toBe("ok");
      expect(op).toHaveBeenCalledOnce();
    });

    it("retries on retryable errors", async () => {
      let calls = 0;
      const op = vi.fn().mockImplementation(async () => {
        calls++;
        if (calls < 3) {
          throw new Error("rate limit exceeded");
        }
        return "success";
      });

      const promise = withRetry(op, {
        backoffMultiplier: 1,
        initialDelayMs: 10,
        maxAttempts: 3,
        maxDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result).toBe("success");
      expect(op).toHaveBeenCalledTimes(3);
    });

    it("throws immediately for non-retryable errors", async () => {
      const op = vi.fn().mockRejectedValue(new Error("Invalid API key"));
      await expect(
        withRetry(op, { initialDelayMs: 0, maxAttempts: 3 })
      ).rejects.toThrow("Invalid API key");
      expect(op).toHaveBeenCalledOnce();
    });

    it("exhausts retries and throws last error", async () => {
      const op = vi.fn().mockRejectedValue(new Error("rate limit exceeded"));
      const retryPromise = withRetry(op, {
        backoffMultiplier: 1,
        initialDelayMs: 10,
        maxAttempts: 3,
        maxDelayMs: 100,
      });
      const rejectionAssertion = (async () => {
        await expect(retryPromise).rejects.toThrow("rate limit exceeded");
      })();
      await vi.runAllTimersAsync();
      await rejectionAssertion;
      expect(op).toHaveBeenCalledTimes(3);
    });

    it("respects abort signal", async () => {
      const controller = new AbortController();
      controller.abort();
      const op = vi.fn().mockResolvedValue("ok");
      await expect(
        withRetry(op, { signal: controller.signal })
      ).rejects.toThrow("Operation aborted");
    });
  });
});
