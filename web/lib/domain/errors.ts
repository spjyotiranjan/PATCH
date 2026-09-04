export class DomainError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "DomainError";
  }
}

export function notFound(code: string): never {
  throw new DomainError(404, code);
}

export function forbidden(code = "FORBIDDEN"): never {
  throw new DomainError(403, code);
}

export function conflict(code: string): never {
  throw new DomainError(409, code);
}
