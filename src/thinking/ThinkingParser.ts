export interface ThinkingParserOptions {
  openingTag?: string;
  closingTag?: string;
}

type ThinkingState =
  | 'lookingForOpening'
  | 'thinkingStartedEatingWhitespace'
  | 'thinking'
  | 'thinkingDoneEatingWhitespace'
  | 'thinkingDone';

export class ThinkingParser {
  private _state: ThinkingState = 'lookingForOpening';
  private _acc = '';

  public readonly openingTag: string;
  public readonly closingTag: string;

  public constructor(options: ThinkingParserOptions = {}) {
    this.openingTag = options.openingTag ?? '<think>';
    this.closingTag = options.closingTag ?? '</think>';
  }

  public addContent(chunk: string): [thinkingContent: string, regularContent: string] {
    this._acc += chunk;
    let thinkingOut = '';
    let contentOut = '';
    let keepLooping = true;

    while (keepLooping) {
      const [thinkingDelta, contentDelta, shouldContinue] = this._eat();
      thinkingOut += thinkingDelta;
      contentOut += contentDelta;
      keepLooping = shouldContinue;
    }

    return [thinkingOut, contentOut];
  }

  public reset(): void {
    this._state = 'lookingForOpening';
    this._acc = '';
  }

  private _eat(): [thinkingContent: string, regularContent: string, shouldContinue: boolean] {
    switch (this._state) {
      case 'lookingForOpening': {
        const trimmed = this._acc.trimStart();
        if (trimmed.startsWith(this.openingTag)) {
          const after = trimmed.slice(this.openingTag.length).trimStart();
          this._acc = after;
          this._state = after === '' ? 'thinkingStartedEatingWhitespace' : 'thinking';
          return ['', '', true];
        }

        if (this.openingTag.startsWith(trimmed) && trimmed !== '') {
          return ['', '', false];
        }

        if (trimmed === '') {
          return ['', '', false];
        }

        this._state = 'thinkingDone';
        const out = this._acc;
        this._acc = '';
        return ['', out, false];
      }

      case 'thinkingStartedEatingWhitespace': {
        const trimmed = this._acc.trimStart();
        this._acc = '';
        if (trimmed === '') {
          return ['', '', false];
        }
        this._state = 'thinking';
        this._acc = trimmed;
        return ['', '', true];
      }

      case 'thinking': {
        const idx = this._acc.indexOf(this.closingTag);
        if (idx !== -1) {
          const thinking = this._acc.slice(0, idx);
          const afterRaw = this._acc.slice(idx + this.closingTag.length);
          const after = afterRaw.trimStart();
          this._acc = '';

          if (afterRaw === '') {
            this._state = 'thinkingDone';
          } else {
            this._state = after === '' ? 'thinkingDoneEatingWhitespace' : 'thinkingDone';
          }

          return [thinking, after, false];
        }

        return ['', '', false];
      }

      case 'thinkingDoneEatingWhitespace': {
        const trimmed = this._acc.trimStart();
        this._acc = '';
        if (trimmed !== '') {
          this._state = 'thinkingDone';
        }
        return ['', trimmed, false];
      }

      case 'thinkingDone': {
        const out = this._acc;
        this._acc = '';
        return ['', out, false];
      }
    }
  }
}
