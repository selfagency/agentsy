export function genericHeaderParser(headers: Headers | Record<string, string>): Record<string, string> {
  const parsed: Record<string, string> = {};

  if (headers instanceof Headers) {
    for (const [key, value] of headers.entries()) {
      // nosemgrep: typescript.lang.security.detect-object-injection.detect-object-injection — building parsed object from iterated keys
      parsed[key.toLowerCase()] = value;
    }
    return parsed;
  }

  for (const [key, value] of Object.entries(headers)) {
    // nosemgrep: typescript.lang.security.detect-object-injection.detect-object-injection — building parsed object from iterated keys
    parsed[key.toLowerCase()] = value;
  }

  return parsed;
}
