#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# predict.sh — CLI wrapper for the VecML Titanic inference API
#
# Usage:
#   ./predict.sh '{"Pclass":3,"Sex":"male","Age":22,"SibSp":1,"Parch":0,"Fare":7.25,"Embarked":"S"}'
#   ./predict.sh --batch passengers.json
#   ./predict.sh --health
#   ./predict.sh --info
#
# Falls back to direct VecML API if local server is not running.
# ─────────────────────────────────────────────────────────────────────────────

API_URL="${INFERENCE_API_URL:-http://localhost:4242}"

check_server() {
  curl -sf "$API_URL/health" > /dev/null 2>&1
}

pretty() {
  python3 -m json.tool 2>/dev/null || cat
}

case "$1" in
  --health)
    echo "Checking inference API at $API_URL..."
    curl -sf "$API_URL/health" | pretty
    ;;

  --info)
    echo "Model info:"
    curl -sf "$API_URL/model/info" | pretty
    ;;

  --batch)
    FILE="$2"
    if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
      echo "Error: provide a JSON file with --batch <file.json>"
      echo "File format: [{\"Pclass\":1,\"Sex\":\"female\",...}, ...]"
      exit 1
    fi
    echo "Batch predicting from $FILE..."
    PAYLOAD=$(python3 -c "import json,sys; rows=json.load(open('$FILE')); print(json.dumps({'rows':rows}))")
    curl -sf -X POST "$API_URL/predict" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" | pretty
    ;;

  --start)
    echo "Starting inference server..."
    cd "$(dirname "$0")" && node server.js &
    sleep 1
    if check_server; then
      echo "✅ Server running at $API_URL"
    else
      echo "❌ Server failed to start"
    fi
    ;;

  "")
    echo "Usage:"
    echo "  $0 '{\"Pclass\":1,\"Sex\":\"female\",\"Age\":29,\"SibSp\":0,\"Parch\":0,\"Fare\":211.3,\"Embarked\":\"S\"}'"
    echo "  $0 --batch passengers.json"
    echo "  $0 --health"
    echo "  $0 --info"
    echo "  $0 --start"
    ;;

  *)
    # Treat $1 as raw JSON for a single passenger
    PASSENGER="$1"
    if ! check_server; then
      echo "⚠️  Local server not running — starting it now..."
      cd "$(dirname "$0")" && node server.js &
      sleep 2
    fi

    echo "Predicting..."
    RESULT=$(curl -sf -X POST "$API_URL/predict" \
      -H "Content-Type: application/json" \
      -d "$PASSENGER")

    if [ $? -ne 0 ]; then
      echo "❌ Prediction failed. Is the server running? Try: $0 --start"
      exit 1
    fi

    echo "$RESULT" | pretty

    # Quick human-readable summary
    LABEL=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['labels'][0])" 2>/dev/null)
    if [ -n "$LABEL" ]; then
      if [ "$LABEL" = "survived" ]; then
        echo ""
        echo "  ✅ Prediction: SURVIVED"
      else
        echo ""
        echo "  ❌ Prediction: DIED"
      fi
    fi
    ;;
esac
