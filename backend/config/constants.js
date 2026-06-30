if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("FATAL: JWT_SECRET environment variable must be set in production.");
}

export const JWT_SECRET = process.env.JWT_SECRET || "coshield_dev_jwt_secret_do_not_use_in_production";
export const FRONTEND_CALLBACK_URL = process.env.FRONTEND_CALLBACK_URL || "http://localhost:5173/auth/callback";

export const CACHE_TTL = {
  COMPLIANCE_QUERY: 3600,
  DOCUMENTS_LIST: 300,
};

export const ROLE_HIERARCHY = {
  USER: 1,
  COMPLIANCE_OFFICER: 2,
  ADMIN: 3,
};
