import express from "express";
import { requireAuth, requireProfileRole } from "../middlewares/requireAuth.js";
import { aiRouteRateLimiter } from "../middlewares/rateLimiter.js";
import { validate } from "../middlewares/validate.js";
import { chatSchemas } from "../validation/schemas.js";
import { createChatCompletion } from "../controllers/chatController.js";
const router = express.Router();

router.post(
  "/chat",
  requireAuth,
  requireProfileRole("mentor", "learner"),
  aiRouteRateLimiter,
  validate(chatSchemas.chatCompletion),
  createChatCompletion
);

export default router;
