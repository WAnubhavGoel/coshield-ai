import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma/prisma.js";

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { tenant: true }
        });

        if (!user) {
          return done(null, false, { message: "Invalid email or password" });
        }

        if (!user.passwordHash) {
          return done(null, false, { message: "Account registered with Google login. Please sign in via Google." });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          return done(null, false, { message: "Invalid email or password" });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/v1/auth/google/callback";

if (googleClientId && googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) {
            return done(new Error("No email returned from Google OAuth"));
          }

          let user = await prisma.user.findUnique({
            where: { email },
            include: { tenant: true }
          });

          if (!user) {
            const domain = email.split("@")[1];
            const tenantName = domain.split(".")[0];
            const tenantTitle = tenantName.charAt(0).toUpperCase() + tenantName.slice(1);

            let tenant = await prisma.tenant.findFirst({
              where: { name: tenantTitle }
            });

            if (!tenant) {
              tenant = await prisma.tenant.create({
                data: { name: tenantTitle }
              });
            }

            user = await prisma.user.create({
              data: {
                email,
                googleId: profile.id,
                role: "USER",
                tenantId: tenant.id
              },
              include: { tenant: true }
            });
          } else if (!user.googleId) {
            user = await prisma.user.update({
              where: { email },
              data: { googleId: profile.id },
              include: { tenant: true }
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
} else {
  console.warn("Passport Google OAuth credentials missing in environment. Google login is disabled.");
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
