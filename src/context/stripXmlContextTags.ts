export function stripXmlContextTags(input: string): string {
  const openTag = '<context';
  const closeTag = '</context';

  let result = '';
  let i = 0;
  const len = input.length;
  let contextDepth = 0;

  while (i < len) {
    if (input.startsWith(openTag, i)) {
      const nextChar = input[i + openTag.length];

      if (nextChar === undefined) {
        throw new Error('Malformed <context tag: incomplete tag at end of input');
      }
      if (!/[\s/>]/.test(nextChar)) {
        if (contextDepth === 0) {
          result += input[i];
        }
        i += 1;
        continue;
      }

      const endOfTag = input.indexOf('>', i + openTag.length);
      if (endOfTag === -1) {
        throw new Error('Malformed <context...> tag: missing closing ">"');
      }

      contextDepth += 1;
      i = endOfTag + 1;
      continue;
    }

    if (input.startsWith(closeTag, i)) {
      const nextChar = input[i + closeTag.length];

      if (nextChar === undefined) {
        throw new Error('Malformed </context tag: incomplete tag at end of input');
      }
      if (!/[\s>]/.test(nextChar)) {
        if (contextDepth === 0) {
          result += input[i];
        }
        i += 1;
        continue;
      }

      const endOfTag = input.indexOf('>', i + closeTag.length);
      if (endOfTag === -1) {
        throw new Error('Malformed </context...> tag: missing closing ">"');
      }
      if (contextDepth === 0) {
        throw new Error('Unmatched </context> closing tag in input');
      }

      contextDepth -= 1;
      i = endOfTag + 1;
      continue;
    }

    if (contextDepth === 0) {
      result += input[i];
    }
    i += 1;
  }

  if (contextDepth !== 0) {
    throw new Error('Unclosed <context> tag in input');
  }

  return result;
}
