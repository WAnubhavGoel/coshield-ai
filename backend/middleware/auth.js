import jwt from "jsonwebtoken";
import { prisma } from "../prisma/prisma.js";
import { JWT_SECRET, ROLE_HIERARCHY } from "../config/constants.js";

export const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  let token = req.query.token || null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "Access token missing or malformed" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token has expired. Please log in again." });
    }
    return res.status(403).json({ error: "Invalid token" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        tenant: true,
        departments: {
          select: {
            departmentId: true,
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
  } catch (dbError) {
    console.error("Database error during user authentication:", dbError);
    return res.status(500).json({ error: "Database error during authentication" });
  }
};

export const requireRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userRoleValue = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredRoleValue = ROLE_HIERARCHY[minRole] || 0;

    if (userRoleValue < requiredRoleValue) {
      return res.status(403).json({ error: `Requires role: ${minRole} or higher` });
    }

    next();
  };
};
