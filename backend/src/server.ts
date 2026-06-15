import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.js";
import explainRouter from "./routes/explain.routes.js";
import documentRouter from "./routes/document.routes.js";
import threatRouter from "./routes/threat.routes.js";
import highlightRouter from "./routes/highlight.routes.js";

dotenv.config();

const app = express();

// Trust proxy - required for Cloud Run / reverse proxies
// so that req.secure and cookie secure flag work correctly
app.set("trust proxy", 1);

const PORT = process.env.PORT || 6900;

const allowedOrigins = process.env.CLIENT_BASE_URL
  ? process.env.CLIENT_BASE_URL.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

app.get("/", (_req, res) => {
  res.send(`This is your API`);
});

app.use("/auth", authRouter);
app.use("/documents", documentRouter);
app.use("/explanations", explainRouter);
app.use("/threats", threatRouter);
app.use("/highlights", highlightRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
