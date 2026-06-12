export interface RedactionPattern {
  readonly name: string;
  readonly regex: RegExp;
}

export interface RedactionOptions {
  readonly patterns?: readonly RedactionPattern[];
  readonly replacement?: string;
  readonly values?: readonly string[];
}

export class Redactor {
  readonly #patterns: readonly RedactionPattern[];
  readonly #replacement: string;
  readonly #values: readonly string[];

  constructor(options: RedactionOptions = {}) {
    this.#patterns = options.patterns ?? [];
    this.#replacement = options.replacement ?? "[REDACTED]";
    this.#values = (options.values ?? []).filter((value) => value.length > 0);
  }

  redact(value: string): string {
    let redacted = value;

    for (const secret of this.#values) {
      redacted = redacted.replaceAll(secret, this.#replacement);
    }

    for (const pattern of this.#patterns) {
      redacted = redacted.replace(pattern.regex, this.#replacement);
    }

    return redacted;
  }

  redactList(values: readonly string[]): readonly string[] {
    return values.map((value) => this.redact(value));
  }
}
