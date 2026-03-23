import type { Request, Response, NextFunction } from "express";
import type { z } from "zod";
import { messageFromZodError } from "./formatZodError.js";

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const message = messageFromZodError(parsed.error);
      return res.status(400).json({
        error: "Invalid request body",
        message,
        details: parsed.error.flatten(),
      });
    }
    (req as Request & { body: z.infer<T> }).body = parsed.data;
    next();
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      const message = messageFromZodError(parsed.error);
      return res.status(400).json({
        error: "Invalid query parameters",
        message,
        details: parsed.error.flatten(),
      });
    }
    (req as Request & { validatedQuery: z.infer<T> }).validatedQuery = parsed.data;
    next();
  };
}

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      const message = messageFromZodError(parsed.error);
      return res.status(400).json({
        error: "Invalid path parameters",
        message,
        details: parsed.error.flatten(),
      });
    }
    (req as Request & { validatedParams: z.infer<T> }).validatedParams = parsed.data;
    next();
  };
}
