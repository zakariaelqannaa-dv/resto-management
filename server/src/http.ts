import type { NextFunction, Request, Response } from 'express'

export class HttpError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`)

/** Reads a required URL parameter (typed as possibly missing by noUncheckedIndexedAccess). */
export function param(req: Request, name: string): string {
  const value = req.params[name]
  if (!value) throw new HttpError(400, `Missing URL parameter "${name}"`)
  return value
}

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown

/** Wraps async route handlers so rejected promises reach the error middleware. */
export const handler = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export function errorMiddleware(error: any, _req: Request, res: Response, _next: NextFunction) {
  const status = error?.status ?? 500
  if (status >= 500) console.error(error)

  if (error?.code === '23505' || error?.code === '23505') {
    return res.status(409).json({ error: 'That value already exists', detail: error.detail })
  }

  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : error.message,
    details: error.details,
  })
}
