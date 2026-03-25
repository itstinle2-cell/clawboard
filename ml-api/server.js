/**
 * VecML Titanic Inference API
 * Wraps the VecML AutoML API into a clean local endpoint.
 *
 * POST /predict       — predict survival for one or many passengers
 * GET  /health        — liveness check
 * GET  /model/info    — model metadata + feature importance
 */

const express = require("express");
const cors = require("cors");
const https = require("https");

const app = express();
app.use(cors());
app.use(express.json());

// ── Config ────────────────────────────────────────────────────────────────────
const VECML_API   = "https://aidb.vecml.com/api";
const API_KEY     = process.env.VECML_API_KEY || "vml_qo3fDISj9Z0xx6ADok_kjuTEPJQsn6ZsBSZczsB_iFc";
const PROJECT     = process.env.VECML_PROJECT     || "titanic_demo";
const COLLECTION  = process.env.VECML_COLLECTION  || "titanic_survival";
const MODEL       = process.env.VECML_MODEL       || "titanic_classifier_v1";
const PORT        = process.env.PORT              || 4242;

// ── VecML helper ──────────────────────────────────────────────────────────────
function vecmlPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      `${VECML_API}/${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── CSV builder from JSON rows ────────────────────────────────────────────────
const FEATURES = ["Pclass", "Sex", "Age", "SibSp", "Parch", "Fare", "Embarked"];
const CATEGORICAL = ["Sex", "Embarked", "Pclass"];

function rowsToCSVBase64(rows) {
  const header = FEATURES.join(",");
  const lines = rows.map((r) =>
    FEATURES.map((f) => {
      const v = r[f] ?? r[f.toLowerCase()] ?? "";
      return String(v).includes(",") ? `"${v}"` : v;
    }).join(",")
  );
  const csv = [header, ...lines].join("\n");
  return Buffer.from(csv).toString("base64");
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// GET /health
app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    model: MODEL,
    project: PROJECT,
    collection: COLLECTION,
    timestamp: new Date().toISOString(),
  });
});

// GET /model/info  — feature importance + model metadata
app.get("/model/info", async (_, res) => {
  try {
    const fi = await vecmlPost("get_feature_importance", {
      user_api_key: API_KEY,
      project_name: PROJECT,
      collection_name: COLLECTION,
      model_name: MODEL,
    });

    const metrics = await vecmlPost("get_model_validation_metric", {
      user_api_key: API_KEY,
      project_name: PROJECT,
      collection_name: COLLECTION,
      model_name: MODEL,
    });

    res.json({
      model: MODEL,
      project: PROJECT,
      task: "classification",
      label: "Survived",
      features: FEATURES,
      categorical_features: CATEGORICAL,
      feature_importance: fi.body?.feature_importance ?? [],
      validation_metrics: metrics.body?.validation_metric ?? {},
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /predict
 *
 * Body (single passenger):
 * {
 *   "Pclass": 3, "Sex": "male", "Age": 22,
 *   "SibSp": 1, "Parch": 0, "Fare": 7.25, "Embarked": "S"
 * }
 *
 * Body (batch):
 * { "rows": [ {...}, {...} ] }
 *
 * Response:
 * { "predictions": [0|1], "labels": ["died"|"survived"], "count": N }
 */
app.post("/predict", async (req, res) => {
  try {
    const rows = req.body.rows
      ? req.body.rows
      : [req.body];

    if (!rows.length) {
      return res.status(400).json({ error: "No passenger data provided." });
    }

    // Validate required fields
    const missing = rows.flatMap((r, i) =>
      FEATURES.filter((f) => r[f] === undefined && r[f.toLowerCase()] === undefined)
              .map((f) => `row[${i}].${f}`)
    );
    if (missing.length) {
      return res.status(400).json({
        error: "Missing fields",
        missing,
        required: FEATURES,
        example: {
          Pclass: 1, Sex: "female", Age: 29,
          SibSp: 0, Parch: 0, Fare: 211.3375, Embarked: "S"
        }
      });
    }

    const fileData = rowsToCSVBase64(rows);

    const result = await vecmlPost("automl_predict", {
      user_api_key: API_KEY,
      project_name: PROJECT,
      collection_name: COLLECTION,
      model_name: MODEL,
      file_data: fileData,
      file_format: "csv",
      has_field_names: true,
    });

    if (!result.body?.success) {
      // Surface the raw VecML error so we can debug
      return res.status(502).json({
        error: "VecML prediction failed",
        vecml_response: result.body,
        hint: "Model may need re-training with labels attached before training starts.",
      });
    }

    const preds = result.body.predictions ?? result.body.results ?? [];
    const labels = preds.map((p) => (p === 1 || p === "1" ? "survived" : "died"));

    res.json({
      count: preds.length,
      predictions: preds,
      labels,
      summary: {
        survived: labels.filter((l) => l === "survived").length,
        died: labels.filter((l) => l === "died").length,
      },
      model: MODEL,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 VecML Inference API running on http://localhost:${PORT}`);
  console.log(`   Model  : ${MODEL}`);
  console.log(`   Project: ${PROJECT}`);
  console.log(`\n   Endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /model/info`);
  console.log(`   POST /predict\n`);
});
