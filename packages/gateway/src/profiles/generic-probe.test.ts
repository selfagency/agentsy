import { describe, expect, it, vi } from 'vitest';
import { genericProbe } from './generic-probe.js';

describe('genericProbe', () => {
  describe('successful responses', () => {
    it('should return ok: true for 200 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers()
      } as Response);

      const result = await genericProbe('https://api.example.com/health');

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(result.remaining).toBeUndefined();
    });

    it('should return ok: true for 201 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers()
      } as Response);

      const result = await genericProbe('https://api.example.com/create');

      expect(result.ok).toBe(true);
      expect(result.status).toBe(201);
    });

    it('should return ok: true for 204 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers()
      } as Response);

      const result = await genericProbe('https://api.example.com/delete');

      expect(result.ok).toBe(true);
      expect(result.status).toBe(204);
    });
  });

  describe('error responses', () => {
    it('should return ok: false for 400 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers()
      } as Response);

      const result = await genericProbe('https://api.example.com/error');

      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
    });

    it('should return ok: false for 404 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers()
      } as Response);

      const result = await genericProbe('https://api.example.com/notfound');

      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
    });

    it('should return ok: false for 500 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers()
      } as Response);

      const result = await genericProbe('https://api.example.com/server-error');

      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
    });

    it('should return ok: false for 503 response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers()
      } as Response);

      const result = await genericProbe('https://api.example.com/unavailable');

      expect(result.ok).toBe(false);
      expect(result.status).toBe(503);
    });
  });

  describe('rate limit headers', () => {
    it('should parse x-ratelimit-remaining header', async () => {
      const headers = new Headers();
      headers.set('x-ratelimit-remaining', '42');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers
      } as Response);

      const result = await genericProbe('https://api.example.com/endpoint');

      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(42);
    });

    it('should handle missing rate limit header', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers()
      } as Response);

      const result = await genericProbe('custom-probe');

      expect(result.ok).toBe(true);
      expect(result.remaining).toBeUndefined();
    });

    it('should parse rate limit header with error response', async () => {
      const headers = new Headers();
      headers.set('x-ratelimit-remaining', '10');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers
      } as Response);

      const result = await genericProbe('https://api.example.com/limited');

      expect(result.ok).toBe(false);
      expect(result.remaining).toBe(10);
      expect(result.status).toBe(429);
    });

    it('should handle zero rate limit remaining', async () => {
      const headers = new Headers();
      headers.set('x-ratelimit-remaining', '0');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers
      } as Response);

      const result = await genericProbe('https://api.example.com/endpoint');

      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should handle large rate limit remaining', async () => {
      const headers = new Headers();
      headers.set('x-ratelimit-remaining', '999999');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers
      } as Response);

      const result = await genericProbe('https://api.example.com/endpoint');

      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(999_999);
    });
  });

  describe('request options', () => {
    it('should pass through request init options', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers()
      } as Response);

      const init: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      };

      await genericProbe('https://api.example.com/endpoint', init);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ test: 'data' })
        })
      );
    });

    it('should handle GET requests', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers()
      } as Response);

      await genericProbe('https://api.example.com/endpoint', { method: 'GET' });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should handle POST requests', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers()
      } as Response);

      await genericProbe('https://api.example.com/endpoint', {
        method: 'POST',
        body: 'test data'
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.objectContaining({ method: 'POST', body: 'test data' })
      );
    });

    it('should handle PUT requests', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers()
      } as Response);

      await genericProbe('https://api.example.com/endpoint', {
        method: 'PUT',
        body: 'updated data'
      });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.objectContaining({ method: 'PUT', body: 'updated data' })
      );
    });

    it('should handle DELETE requests', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers()
      } as Response);

      await genericProbe('https://api.example.com/endpoint', { method: 'DELETE' });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle network errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(genericProbe('https://api.example.com/endpoint')).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));

      await expect(genericProbe('https://api.example.com/endpoint')).rejects.toThrow('Timeout');
    });

    it('should handle malformed URLs', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Invalid URL'));

      await expect(genericProbe('not-a-valid-url')).rejects.toThrow('Invalid URL');
    });

    it('should handle empty response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 0,
        headers: new Headers()
      } as Response);

      const result = await genericProbe('https://api.example.com/endpoint');

      expect(result.ok).toBe(false);
      expect(result.status).toBe(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete request lifecycle', async () => {
      const headers = new Headers();
      headers.set('x-ratelimit-remaining', '100');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers
      } as Response);

      const result = await genericProbe('https://api.example.com/endpoint');

      expect(result).toEqual({ ok: true, status: 200, remaining: 100 });
    });

    it('should handle rate limit exhaustion', async () => {
      const headers = new Headers();
      headers.set('x-ratelimit-remaining', '0');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers
      } as Response);

      const result = await genericProbe('https://api.example.com/endpoint');

      expect(result).toEqual({ ok: false, status: 429, remaining: 0 });
    });

    it('should handle server error with rate limit info', async () => {
      const headers = new Headers();
      headers.set('x-ratelimit-remaining', '5');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers
      } as Response);

      const result = await genericProbe('https://api.example.com/endpoint');

      expect(result).toEqual({ ok: false, status: 503, remaining: 5 });
    });
  });
});
