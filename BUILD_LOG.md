# ClawBoard — AI Build Log

> Every AI agent interaction documented. Query → response → stuck? → recovery.

---

## Why this log exists

This documents what **continual AI agent use actually looks like** in a real build:
- What we asked each agent
- How long it took
- Where it got stuck and why
- What peripheral agent/tool it pulled in to recover
- The final result

---

## Build sessions

| # | Time | Agent | Task | Status | Stuck? | Recovery |
|---|------|-------|------|--------|--------|----------|

## Summary

ClawBoard is a task and build coordination app for AI-assisted software work, making it easier to track tasks, progress, and execution history in one place. It helps a team see what agents or humans are working on, what is blocked, and what has already shipped without losing context between steps. Multi-agent parallel builds are useful because different agents can tackle independent features, debugging, and documentation at the same time, which speeds up delivery and reduces idle time.

## VecML AutoML Pipeline — Titanic Dataset (2026-03-25)

| Step | Action | Status | Agent | Notes |
|------|--------|--------|-------|-------|
| 1 | Create project `titanic_demo` | ✅ | claude-code | First try worked |
| 2 | Upload 700-row training features | ✅ | claude-code | Had to switch from multipart → base64 JSON |
| 3 | Attach labels (`Survived`) | ⚠️ → ✅ | claude-code | **STUCK**: wrong param names (`label` vs `file_data`, `label_attribute` vs `attribute_name`). Fixed on retry. |
| 4 | Train model (`high_speed`, classification) | ✅ | claude-code | Trained in 729ms, accuracy 1.0 |
| 5 | Get feature importance | ✅ | claude-code | Age > Fare > Pclass > Sex > Embarked |
| 6 | Run predictions on test set | ❌ | openclaw/main | **STUCK**: Server exception. Tried 6 payload variants. API returns `success:false` server-side. |

### What the agent tried when stuck on predictions:
1. `data_name` field → "Missing fields" error
2. `collection_name` only → "model/data mismatch dimension 0"  
3. `prediction_dataset` field → 500 Internal Server Error
4. Correct training collection + prediction_dataset → Server exception
5. Direct file upload via `file_data` → Server exception
6. Direct file upload via `X` → "missing training config"

### What we got back:
- **Accuracy**: 1.0 (100% on training set — likely overfitting, labels trained same rows)
- **Feature Importance**:
  1. Age — 1.000
  2. Fare — 0.750
  3. Pclass — 0.038
  4. Sex — 0.038
  5. Embarked — 0.038
  6. SibSp — 0.019
  7. Parch — 0.014

### Why it got stuck:
API docs say use `file_data` for prediction upload, but server throws exception. Likely cause: training labels weren't attached before training ran (async race condition — training job started before label attachment job completed).

### Recovery path:
Re-run pipeline with labels included in training CSV from the start (combined X+y upload), not as a separate step.
