export interface GenericProbeResult {
  ok: boolean;
  remaining?: number;
  status?: number;
}

export async function genericProbe(url: string, init: RequestInit = {}): Promise<GenericProbeResult> {
  const response = await fetch(url, init);
  const remainingHeader = response.headers.get('x-ratelimit-remaining');

  const result: GenericProbeResult = { ok: response.ok };
  if (remainingHeader !== null) {
    result.remaining = Number(remainingHeader);
  }
  if (response.status !== undefined) {
    result.status = response.status;
  }
  return result;
}
