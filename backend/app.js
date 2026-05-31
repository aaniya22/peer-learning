import express from "express";
import { randomUUID } from "crypto";
import authRoutes from "./routers/authRoutes.js";
import chatRoutes from "./routers/chatRoutes.js";
import aiRoutes from "./routers/aiRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.set("trust proxy", 1);
app.use(express.json());
app.use((req, res, next) => {
	req.requestId = req.headers["x-request-id"] || randomUUID();
	res.setHeader("x-request-id", req.requestId);
	next();
});

app.use("/api/ai", aiRoutes);
app.use("/api", authRoutes);
app.use("/api", chatRoutes);

app.use(errorHandler);

export default app;
