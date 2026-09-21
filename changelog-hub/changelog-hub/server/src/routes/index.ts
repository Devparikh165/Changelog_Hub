import { Router } from "express";
import * as admin from "../controllers/admin.controller.js";
import * as auth from "../controllers/auth.controller.js";
import * as changelog from "../controllers/changelog.controller.js";
import * as system from "../controllers/system.controller.js";
import { authenticate, requireAdmin, requireUser, requireVerified } from "../middleware/auth.js";
import { authRateLimit } from "../middleware/security.js";
import { imageUpload } from "../middleware/upload.js";

/* ── /api/v1/auth ──────────────────────────────────────────────────────── */
const authRouter = Router();
authRouter.post("/signup", authRateLimit(), auth.signup);
authRouter.post("/verify-email", auth.verifyEmail);
authRouter.post("/resend-verification", authRateLimit(), auth.resendVerification);
authRouter.post("/login", authRateLimit(), auth.login);
authRouter.post("/refresh", auth.refresh);
authRouter.post("/logout", auth.logout);
authRouter.post("/forgot-password", authRateLimit(), auth.forgotPassword);
authRouter.post("/reset-password", authRateLimit(), auth.resetPassword);
authRouter.get("/me", authenticate, requireUser, auth.me);

/* ── /api/v1/changelog (public; signed-in viewers get their own reactions and unread state) ── */
const changelogRouter = Router();
changelogRouter.get("/feed", changelog.feed); // anonymous by design: no per-viewer data
changelogRouter.use(authenticate);
changelogRouter.get("/", changelog.list);
changelogRouter.get("/unread-count", changelog.unreadCount);
changelogRouter.post("/mark-read", requireUser, changelog.markRead);
changelogRouter.get("/:slug", changelog.getBySlug);
changelogRouter.post("/:id/reactions", requireVerified, changelog.react);

/* ── /api/v1/admin (RBAC: admins only) ─────────────────────────────────── */
const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);
adminRouter.get("/entries", admin.list);
adminRouter.post("/entries", admin.create);
adminRouter.get("/entries/:id", admin.get);
adminRouter.patch("/entries/:id", admin.update);
adminRouter.post("/entries/:id/publish", admin.publish);
adminRouter.post("/entries/:id/unpublish", admin.unpublish);
adminRouter.delete("/entries/:id", admin.remove);
adminRouter.post("/uploads", imageUpload, admin.upload);

/* ── /api/v1 ───────────────────────────────────────────────────────────── */
export const apiRouter = Router();
apiRouter.get("/health", system.health);
apiRouter.use("/auth", authRouter);
apiRouter.use("/changelog", changelogRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.get("/dev/mailbox", system.mailbox);
