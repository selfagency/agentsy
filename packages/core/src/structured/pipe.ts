export type Parser<In, Out> = (input: In) => Out;

export function pipe<A, B, C>(
  first: Parser<A, B>,
  second: Parser<B, C>
): Parser<A, C>;
export function pipe<A, B, C, D>(
  first: Parser<A, B>,
  second: Parser<B, C>,
  third: Parser<C, D>
): Parser<A, D>;
export function pipe(
  ...parsers: ((input: unknown) => unknown)[]
): (input: unknown) => unknown {
  return (input: unknown) =>
    parsers.reduce((value, parser) => parser(value), input);
}
