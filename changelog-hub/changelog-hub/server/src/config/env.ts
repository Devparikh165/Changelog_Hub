import { z } from "zod";

// Load server/.env when present. Real environment variables win, and tests configure
// everything themselves, so the file is skipped there.
if (process.env.NODE_ENV !== "test") {
  try {
    process.loadEnvFile();
  } catch {
    /* no .env file: rely on the process environment */
  }
}

const secret = (name: string) =>
  z
    .string({ error: `${name} is missing. Run \`npm run setup\` from the project root to generate it.` })
    .min(32, { error: `${name} must be at least 32 characters long.` });

const list = z
  .string()
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );

const schema = z
  .object({
    APP_NAME: z.string().default("Changelog Hub"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(8000),
    MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/changelog_hub"),

    JWT_ACCESS_SECRET: secret("JWT_ACCESS_SECRET"),
    JWT_REFRESH_SECRET: secret("JWT_REFRESH_SECRET"),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(120).default(10),

    COOKIE_SECURE: z.stringbool().default(false),
    COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
    COOKIE_DOMAIN: z.string().optional().transform((v) => v || undefined),

    CORS_ORIGINS: list.default(["http://localhost:5173"]),
    FRONTEND_URL: z.string().default("http://localhost:5173").transform((v) => v.replace(/\/$/, "")),
    PUBLIC_API_URL: z.string().default("http://localhost:8000").transform((v) => v.replace(/\/$/, "")),

    EMAIL_SIMULATION: z.stringbool().default(true),
    EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().min(1).default(24),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).default(30),

    UPLOAD_DIR: z.string().default("uploads"),
    MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(50).default(5),

    RATE_LIMIT_ENABLED: z.stringbool().default(true),
    RATE_LIMIT_ATTEMPTS: z.coerce.number().int().min(1).default(10),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(300),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    ADMIN_EMAIL: z.string().default("admin@changelog.dev"),
    ADMIN_PASSWORD: z.string().default("Admin@12345"),
    ADMIN_NAME: z.string().default("Release Admin"),
  })
  .refine((e) => e.JWT_ACCESS_SECRET !== e.JWT_REFRESH_SECRET, {
    error: "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.",
    path: ["JWT_REFRESH_SECRET"],
  })
  .refine((e) => e.NODE_ENV !== "production" || e.COOKIE_SECURE, {
    error: "COOKIE_SECURE must be true in production.",
    path: ["COOKIE_SECURE"],
  })
  .refine((e) => e.COOKIE_SAMESITE !== "none" || e.COOKIE_SECURE, {
    error: "COOKIE_SAMESITE=none requires COOKIE_SECURE=true.",
    path: ["COOKIE_SAMESITE"],
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("\n✖ Invalid server configuration (server/.env):\n");
  for (const issue of parsed.error.issues) {
    console.error(`  • ${issue.path.join(".") || "env"}: ${issue.message}`);
  }
  console.error("\nSee server/.env.example for every available setting.\n");
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  isTest: parsed.data.NODE_ENV === "test",
  /** The dev inbox exists only while emails are simulated outside production. */
  devToolsEnabled: parsed.data.EMAIL_SIMULATION && parsed.data.NODE_ENV !== "production",
};
