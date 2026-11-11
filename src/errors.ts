// src/errors.ts

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// The content was checked and refused by content moderation
export class ContentRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentRejectedError';
  }
}
