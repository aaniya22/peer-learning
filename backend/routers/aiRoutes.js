import express from "express";

import {
  askAI,
  generateSessionSummary,
} from "../controllers/aiController.js";

import { requireAuth, requireProfileRole } from "../middlewares/requireAuth.js";
import { aiRouteRateLimiter } from "../middlewares/rateLimiter.js";
import { validate } from "../middlewares/validate.js";
import { aiSchemas } from "../validation/schemas.js";

const router = express.Router();

/**
 * AI chat endpoint (secured version from main)
 */
router.post(
  "/ask",
  requireAuth,
  requireProfileRole("mentor", "learner"),
  aiRouteRateLimiter,
  validate(aiSchemas.askAI),
  askAI
);

/**
 * Session summary generator (new feature)
 */
router.post(
  "/generate-summary",
  requireAuth,
  requireProfileRole("mentor", "learner"),
  aiRouteRateLimiter,
  validate(aiSchemas.generateSessionSummary),
  generateSessionSummary
);

export default router;