export function genericErrorClassifier(status: number, body = ''): string {
  if (status === 429) {
    return 'rate_limited';
  }
  if (status >= 500) {
    return 'provider_unavailable';
  }
  if (body.toLowerCase().includes('quota')) {
    return 'quota_exceeded';
  }
  return status >= 400 ? 'provider_error' : 'ok';
}
