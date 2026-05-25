export function genericHeaderParser(headers: Headers | Record<string, string>): Record<string, string> {
  const parsed: Record<string, string> = {};

  if (headers instanceof Headers) {
    for (const [key, value] of headers.entries()) {
      parsed[key.toLowerCase()] = value;
    }
    return parsed;
  }

  for (const [key, value] of Object.entries(headers)) {
    parsed[key.toLowerCase()] = value;
  }

  return parsed;
}
