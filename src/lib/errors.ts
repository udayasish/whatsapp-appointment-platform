export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly expose = true
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

/** An upstream provider (Meta) failed or rejected our call. */
export class BadGatewayError extends AppError {
  constructor(message = "Upstream service error") {
    super(message, 502);
  }
}
