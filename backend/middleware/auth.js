import jwt from "jsonwebtoken";
import { prisma } from "../prisma/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "coshield_default_jwt_secret_key_123456";

export const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access token missing or malformed" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        tenant: true,
        departments: {
          select: {
            departmentId: true,
            department: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ error: "User not found or account is inactive" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      departments: user.departments.map(d => d.departmentId)
    };

    next();
  } catch (error) {
    console.error("JWT Verification error:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

export const requireRole = (minRole) => {
  const roleHierarchy = {
    USER: 1,
    COMPLIANCE_OFFICER: 2,
    ADMIN: 3
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userRoleValue = roleHierarchy[req.user.role] || 0;
    const requiredRoleValue = roleHierarchy[minRole] || 0;

    if (userRoleValue < requiredRoleValue) {
      return res.status(403).json({ error: `Requires role: ${minRole} or higher` });
    }

    next();
  };
};
