import json
import math
from pathlib import Path

import numpy as np
from flask import Flask, jsonify, send_from_directory

from db import get_history, get_latest, init_db
from market_data import load_stocks, update_all

ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=str(ROOT), static_url_path="")


def regression(points, method):
    if len(points) < 2:
        return None

    x = np.arange(len(points), dtype=float)
    y = np.array([p["close"] for p in points], dtype=float)

    if method == "log":
        valid = y > 0
        x_fit = x[valid]
        y_fit = np.log(y[valid])
        slope, intercept = np.polyfit(x_fit, y_fit, 1)
        fitted = np.exp(intercept + slope * x)
        annual_growth = math.exp(slope * 252) - 1
    else:
        slope, intercept = np.polyfit(x, y, 1)
        fitted = intercept + slope * x
        current = fitted[-1]
        annual_growth = (slope * 252 / current) if current else 0

    return {
        "values": [float(v) for v in fitted],
        "trend_today": float(fitted[-1]),
        "annual_growth": float(annual_growth),
    }


@app.route("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.route("/mr-market")
def mr_market():
    return send_from_directory(ROOT, "mr_market.html")


@app.route("/api/stocks")
def api_stocks():
    stocks = []
    for stock in load_stocks():
        if not stock.get("enabled", True):
            continue
        latest = get_latest(stock["symbol"])
        stocks.append({**stock, "latest": latest})
    return jsonify(stocks)


@app.route("/api/history/<path:symbol>")
def api_history(symbol):
    from flask import request

    method = request.args.get("method", "linear")
    if method not in {"linear", "log"}:
        method = "linear"

    rows = get_history(symbol)
    reg = regression(rows, method)

    if reg:
        for row, trend in zip(rows, reg["values"]):
            row["trend"] = trend
        latest_close = rows[-1]["close"]
        reg["price_vs_trend"] = latest_close / reg["trend_today"] if reg["trend_today"] else None

    return jsonify({
        "symbol": symbol,
        "method": method,
        "history": rows,
        "regression": reg,
    })


@app.route("/api/update", methods=["POST"])
def api_update():
    return jsonify(update_all())


if __name__ == "__main__":
    init_db()
    results = update_all()
    for result in results:
        print(result)
    app.run(host="127.0.0.1", port=5003, debug=False)
