import express from "express";
import passport from "passport";
import { register, login, googleCallback } from "../controllers/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login?error=GoogleAuthFailed" }),
  googleCallback
);

export default router;
