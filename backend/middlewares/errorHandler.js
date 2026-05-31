import { ZodError } from "zod";

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = Number.isInteger(error?.statusCode)
    ? error.statusCode
    : Number.isInteger(error?.status)
      ? error.status
      : error instanceof ZodError
        ? 400
        : 500;

  const details =
    error?.details ??
    (error instanceof ZodError
      ? error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        }))
      : null);

  const message = error?.message || "Internal Server Error";

  const requestId = req?.requestId || "unknown";
  const userId = req?.user?.id || "anonymous";
  const reason =
    error?.details?.reason ||
    (statusCode >= 500 ? "internal_error" : statusCode >= 400 ? "request_error" : "ok");

  if (statusCode >= 500 || statusCode === 429) {
    console.error(`[${requestId}] user=${userId} status=${statusCode} reason=${reason}`);
  }

  res.status(statusCode).json({
    statusCode,
    message,
    details,
  });
};
