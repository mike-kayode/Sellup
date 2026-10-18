import { NextResponse } from "next/server";

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  error?: string;
  status: number;
}

export function successResponse<T>(
  data: T,
  message: string = "Success",
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      message,
      data,
    },
    { status }
  );
}

export function errorResponse(
  error: string,
  status: number = 500,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      error,
      ...(details && { details }),
    },
    { status }
  );
}

export function validationError(
  fieldErrors: Record<string, any>,
  message: string = "Validation failed"
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      details: fieldErrors,
    },
    { status: 400 }
  );
}

export function notFoundError(resource: string = "Resource"): NextResponse {
  return errorResponse(`${resource} not found`, 404);
}

export function unauthorizedError(
  message: string = "Unauthorized"
): NextResponse {
  return errorResponse(message, 401);
}

export function forbiddenError(
  message: string = "Forbidden"
): NextResponse {
  return errorResponse(message, 403);
}

export function conflictError(message: string = "Conflict"): NextResponse {
  return errorResponse(message, 409);
}
