import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import passport from "passport";
import { prisma } from "../prisma/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "coshield_default_jwt_secret_key_123456";
const FRONTEND_CALLBACK_URL = process.env.FRONTEND_CALLBACK_URL || "http://localhost:5173/auth/callback";

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
};

export const register = async (req, res) => {
  const { email, password, tenantName, role } = req.body;

  if (!email || !password || !tenantName) {
    return res.status(400).json({ error: "Email, password, and organization name are required" });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    let tenant = await prisma.tenant.findFirst({
      where: { name: tenantName }
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { name: tenantName }
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: role || "USER",
        tenantId: tenant.id
      },
      include: { tenant: true }
    });

    const token = generateToken(user);

    return res.status(210).json({
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant.name
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Internal server error during registration" });
  }
};

export const login = (req, res, next) => {
  passport.authenticate("local", { session: false }, (err, user, info) => {
    if (err) {
      console.error("Passport login error:", err);
      return res.status(500).json({ error: "Internal server error during login" });
    }

    if (!user) {
      return res.status(401).json({ error: info?.message || "Invalid credentials" });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant.name
      }
    });
  })(req, res, next);
};

export const googleCallback = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(`${FRONTEND_CALLBACK_URL}?error=OAuthNoUser`);
    }

    const token = generateToken(req.user);
    return res.redirect(`${FRONTEND_CALLBACK_URL}?token=${token}`);
  } catch (error) {
    console.error("OAuth callback processing error:", error);
    return res.redirect(`${FRONTEND_CALLBACK_URL}?error=OAuthCallbackError`);
  }
};
