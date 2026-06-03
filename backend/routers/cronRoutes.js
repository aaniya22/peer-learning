import express from "express";
import {
  dispatchPushNotifications,
  sendSessionReminders,
} from "../controllers/cronController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

const verifyCronSecret = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized cron request" });
  }
  next();
};

router.post("/dispatch-notifications", verifyCronSecret, asyncHandler(dispatchPushNotifications));
router.post("/reminders", verifyCronSecret, asyncHandler(sendSessionReminders));

export default router;
