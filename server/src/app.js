/* ==========================================================================
   NEXUS TECH — Aplicação Express
   Configura middlewares (helmet, cors restrito, json), monta as rotas e
   os tratamentos de 404 e de erros centralizados.
   ========================================================================== */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const healthRouter = require("./routes/health.routes");
const productsRouter = require("./routes/products.routes");
const adminAuthRouter = require("./routes/admin/auth.routes");
const adminProductsRouter = require("./routes/admin/products.routes");
const productsController = require("./controllers/products.controller");
const adminProductsController = require("./controllers/admin/products.controller");
const { requireAdmin } = require("./middlewares/requireAdmin");
const { adminApiLimiter } = require("./middlewares/rateLimit");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.disable("x-powered-by");
app.use(helmet());

/* CORS restrito ao ambiente local (origem do frontend). */
const corsOrigin = (process.env.CORS_ORIGIN || "http://127.0.0.1:8123")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      // Requisições sem origem (curl, ferramentas) são permitidas em dev
      if (!origin) return cb(null, true);
      if (corsOrigin.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true, // permite envio/recepção do cookie httpOnly de refresh
  })
);

app.use(express.json());

/* --- Rotas --- */
app.use("/api/health", healthRouter);
app.use("/api/products", productsRouter);
app.get("/api/categories", productsController.categories);
app.get("/api/brands", productsController.brands);

/* --- Admin --- */
app.use("/api/admin/auth", adminApiLimiter, adminAuthRouter);
app.use("/api/admin/products", requireAdmin, adminApiLimiter, adminProductsRouter);
app.get("/api/admin/brands", requireAdmin, adminApiLimiter, adminProductsController.brands);
app.get("/api/admin/categories", requireAdmin, adminApiLimiter, adminProductsController.categories);

app.get("/", (req, res) => {
  res.json({ name: "Nexus Tech API", health: "/api/health" });
});

/* --- 404 e erros --- */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
