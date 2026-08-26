export class AuthenticationError extends Error {
  readonly code: string;

  constructor(message: string, code = "AUTH") {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
  }
}

export class NotLoggedInError extends AuthenticationError {
  constructor(message = "Not logged in. Call start_login then complete_login first.") {
    super(message, "NOT_LOGGED_IN");
    this.name = "NotLoggedInError";
  }
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: unknown;

  constructor(status: number, path: string, body: unknown) {
    super(`Benepass API GET ${path} failed (HTTP ${String(status)})`);
    this.name = "ApiHttpError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export class HostNotAllowedError extends Error {
  readonly hostname: string;

  constructor(hostname: string) {
    super(`Refused request to disallowed host: ${hostname}`);
    this.name = "HostNotAllowedError";
    this.hostname = hostname;
  }
}

export class MethodNotAllowedError extends Error {
  readonly method: string;

  constructor(method: string) {
    super(`Refusing non-GET request to Benepass API (${method}). This client is read-only.`);
    this.name = "MethodNotAllowedError";
    this.method = method;
  }
}

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

export type HsaAttempt = {
  account_id: string;
  path: string;
  status: number;
};

export class HsaInvestmentsNotFoundError extends Error {
  readonly attempts: HsaAttempt[];
  readonly hsaAccountDetails: { status: number; body: unknown };

  constructor(
    message: string,
    attempts: HsaAttempt[],
    hsaAccountDetails: { status: number; body: unknown },
  ) {
    super(message);
    this.name = "HsaInvestmentsNotFoundError";
    this.attempts = attempts;
    this.hsaAccountDetails = hsaAccountDetails;
  }
}

export function errorCode(err: unknown): string | undefined {
  if (err instanceof Error && "code" in err && typeof err.code === "string") {
    return err.code;
  }
  return undefined;
}
