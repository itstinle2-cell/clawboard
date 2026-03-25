---
name: titanic-predict
description: >
  Predict Titanic passenger survival using the local VecML AutoML inference API.
  Use this skill when the user asks to predict whether a passenger would survive
  the Titanic, runs a survival prediction, asks about passenger survival odds,
  wants to test the ML model, or asks "would X survive the Titanic?".
  Also use when the user wants to check model health, get feature importance,
  or run batch predictions on multiple passengers.
metadata:
  clawdbot:
    emoji: "🚢"
    requires:
      commands: ["curl", "node"]
      optional_env: ["INFERENCE_API_URL", "VECML_API_KEY"]
    homepage: "https://github.com/itstinle2-cell/clawboard"
---

# Titanic Survival Prediction Skill

Predicts whether a Titanic passenger would have survived, using a trained
AutoML classification model served via a local Express API backed by VecML.

## When to Use

- User asks: *"Would a 22-year-old male in 3rd class survive?"*
- User asks: *"Run a prediction on this passenger data"*
- User asks: *"What does the model say about survival odds?"*
- User asks: *"Check if the ML API is running"*
- User asks: *"Show me the feature importance"*
- User pastes a CSV row and wants a prediction

## Server Management

```bash
# Check if server is running
curl -sf http://localhost:4242/health

# Start server (if not running)
cd ~/clawboard/ml-api && node server.js &

# Or use wrapper
~/clawboard/ml-api/predict.sh --start
```

## Predict — Single Passenger

```bash
curl -X POST http://localhost:4242/predict \
  -H "Content-Type: application/json" \
  -d '{
    "Pclass": 3,
    "Sex": "male",
    "Age": 22,
    "SibSp": 1,
    "Parch": 0,
    "Fare": 7.25,
    "Embarked": "S"
  }'
```

Or via wrapper:
```bash
~/clawboard/ml-api/predict.sh \
  '{"Pclass":3,"Sex":"male","Age":22,"SibSp":1,"Parch":0,"Fare":7.25,"Embarked":"S"}'
```

## Predict — Batch (multiple passengers)

```bash
# Create passengers.json:
# [{"Pclass":1,"Sex":"female","Age":29,...}, {"Pclass":3,"Sex":"male","Age":22,...}]

~/clawboard/ml-api/predict.sh --batch passengers.json
```

## Required Fields

| Field    | Type   | Description                        | Example     |
|----------|--------|------------------------------------|-------------|
| Pclass   | int    | Ticket class (1=first, 3=third)    | 3           |
| Sex      | string | "male" or "female"                 | "male"      |
| Age      | float  | Age in years                       | 22          |
| SibSp    | int    | # siblings/spouses aboard          | 1           |
| Parch    | int    | # parents/children aboard          | 0           |
| Fare     | float  | Ticket price (GBP)                 | 7.25        |
| Embarked | string | Port: "S"=Southampton, "C"=Cherbourg, "Q"=Queenstown | "S" |

## Get Model Info & Feature Importance

```bash
curl http://localhost:4242/model/info
# or
~/clawboard/ml-api/predict.sh --info
```

## Response Format

```json
{
  "count": 1,
  "predictions": [0],
  "labels": ["died"],
  "summary": { "survived": 0, "died": 1 },
  "model": "titanic_classifier_v1"
}
```

## Model Details

- **Model**: `titanic_classifier_v1`
- **Task**: Binary classification (Survived: 0=died, 1=survived)
- **Platform**: VecML AutoML API
- **Project**: `titanic_demo`
- **Top features**: Age > Fare > Pclass > Sex > Embarked
- **Training accuracy**: 1.0 (trained on 700 rows)

## Troubleshooting

```bash
# Server not responding?
~/clawboard/ml-api/predict.sh --start

# VecML API errors?
curl http://localhost:4242/health   # shows model/project config

# Prediction returns 502?
# Model labels may need re-training — run the pipeline again:
cd ~/clawboard && node computer-agent.js "Re-run the titanic training pipeline with labels attached before training"
```
