import express from "express";
import cors from "cors";
import morgan from "morgan";

const app = express();
app.use(cors());                       // CORS for browser calls
app.use(express.json({ limit: "1mb" })); // JSON body
app.use(morgan("tiny"));

const {
  PORT = 10000,        // Render injects this
  AIPIPE_TOKEN = ""     // Optional: set to require Authorization: Bearer <token>
} = process.env;

/** Optional bearer auth */
function requireAuth(req, res, next) {
  if (!AIPIPE_TOKEN) return next(); // auth disabled
  const h = req.get("authorization") || "";
  const want = `Bearer ${AIPIPE_TOKEN}`;
  if (h === want) return next();
  return res.status(401).json({ ok: false, error: "Unauthorized" });
}

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "ai-pipe-service", time: new Date().toISOString() });
});

/**
 * POST /run
 * Body: { "input": "string" }
 * Returns: { ok, engine, received_input, steps[], summary, timestamp, meta }
 */
app.post("/run", requireAuth, async (req, res) => {
  const t0 = Date.now();

  // Validate body
  const input = typeof req.body?.input === "string" ? req.body.input.trim() : "";
  if (!input) {
    return res.status(400).json({ ok: false, error: "Missing 'input' (string) in JSON body" });
  }

  // --- Simple, deterministic “workflow” ---
  // 1) parse
  const parsed = input.replace(/\s+/g, " ").trim();

  // 2) analyze (toy metrics)
  const words = parsed ? parsed.split(/\s+/).length : 0;
  const chars = parsed.length;
  const sentences = (parsed.match(/[.!?]+/g) || []).length || (parsed ? 1 : 0);

  // 3) summarize (compact to <= 160 chars, nice casing)
  let summary = parsed;
  // sentence-case helper
  const sentCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  summary = sentCase(summary);
  if (summary.length > 160) summary = summary.slice(0, 157) + "...";

  const steps = [
    { name: "parse", status: "ok" },
    { name: "analyze", status: "ok", details: { words, chars, sentences } },
    { name: "summarize", status: "ok" }
  ];

  const out = {
    ok: true,
    engine: "aipipe:v1",
    received_input: input,
    steps,
    summary,
    timestamp: new Date().toISOString(),
    meta: { latency_ms: Date.now() - t0, version: "1.0.0" }
  };

  res.set("Cache-Control", "no-store");
  res.json(out);
});

// Fallback 404 (JSON)
app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }));

app.listen(PORT, () => {
  console.log(`AI Pipe service listening on :${PORT}`);
});
