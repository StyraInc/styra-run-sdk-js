export class StyraRunError extends Error {
  constructor(message, cause = undefined) {
    super(cause?.message ? `${message}: ${cause.message}` : message)
    this.name = "StyraRunError"
    this.cause = cause
  }
}

export class StyraRunHttpError extends StyraRunError {
  constructor(message, statusCode, body) {
    super(message)
    this.name = "StyraRunHttpError"
    this.statusCode = statusCode
    this.body = body
  }
}