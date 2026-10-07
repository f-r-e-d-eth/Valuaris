import math
from pathlib import Path

import numpy as np
from flask import Flask, jsonify, send_from_directory

from db import get_history, get_latest, init_db
from market_data import load_stocks, update_all

ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=str(ROOT), static_url_path="")


def _slice_points(points, years=None):
    if not years or not points:
        return points, 0

    cutoff = np.datetime64(points[-1]["date"]) - np.timedelta64(int(years * 365.25), "D")
    start = 0
    for i, point in enumerate(points):
        if np.datetime64(point["date"]) >= cutoff:
            start = i
            break
    return points[start:], start


def regression(points, method):
    if len(points) < 2:
        return None

    window_years = None
    base_method = method

    if method.startswith("log_"):
        base_method = "log"
        window_years = int(method.split("_")[1].replace("y", ""))

    fit_points, offset = _slice_points(points, window_years)
    if len(fit_points) < 2:
        return None

    x_all = np.arange(len(points), dtype=float)
    x_fit = x_all[offset:]
    y_fit_raw = np.array([point["close"] for point in fit_points], dtype=float)

    if base_method == "log":
        valid = y_fit_raw > 0
        x_use = x_fit[valid]
        y_use = np.log(y_fit_raw[valid])
        if len(x_use) < 2:
            return None

        slope, intercept = np.polyfit(x_use, y_use, 1)
        fitted_all = np.exp(intercept + slope * x_all)
        annual_growth = math.exp(slope * 252) - 1
    else:
        slope, intercept = np.polyfit(x_fit, y_fit_raw, 1)
        fitted_all = intercept + slope * x_all
        current = fitted_all[-1]
        annual_growth = (slope * 252 / current) if current and current > 0 else 0

    values = [
        float(value) if np.isfinite(value) and value > 0 else None
        for value in fitted_all
    ]
    trend_today = values[-1]

    return {
        "values": values,
        "trend_today": trend_today,
        "annual_growth": float(annual_growth),
        "window_years": window_years,
    }


def add_price_vs_trend(rows, reg):
    if not rows or not reg:
        return None

    trend_today = reg.get("trend_today")
    if trend_today is None or trend_today <= 0:
        return None

    latest_close = rows[-1]["close"]
    if latest_close is None or latest_close <= 0:
        return None

    return latest_close / trend_today


@app.route("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.route("/mr-market")
def mr_market():
    return send_from_directory(ROOT, "mr_market.html")


@app.route("/mr-market/<path:symbol>")
def mr_market_stock(symbol):
    return send_from_directory(ROOT, "mr_market_stock.html")


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

    method = request.args.get("method", "log")
    allowed = {"linear", "log", "log_20y", "log_10y", "log_5y"}
    if method not in allowed:
        method = "log"

    rows = get_history(symbol)
    reg = regression(rows, method)

    if reg:
        for row, trend in zip(rows, reg["values"]):
            row["trend"] = trend
            row["ratio"] = (
                row["close"] / trend
                if trend is not None and trend > 0 and row["close"] > 0
                else None
            )
        reg["price_vs_trend"] = add_price_vs_trend(rows, reg)

    return jsonify({
        "symbol": symbol,
        "method": method,
        "history": rows,
        "regression": reg,
    })


@app.route("/api/mr-market-all")
def api_mr_market_all():
    from flask import request

    method = request.args.get("method", "log")
    allowed = {"linear", "log", "log_20y", "log_10y", "log_5y"}
    if method not in allowed:
        method = "log"

    series = []

    for stock in load_stocks():
        if not stock.get("enabled", True):
            continue

        rows = get_history(stock["symbol"])
        reg = regression(rows, method)
        if not reg:
            continue

        points = []
        for row, trend in zip(rows, reg["values"]):
            if trend is None or trend <= 0 or row["close"] <= 0:
                continue

            ratio = row["close"] / trend
            if np.isfinite(ratio) and ratio > 0:
                points.append({
                    "date": row["date"],
                    "ratio": float(ratio),
                })

        series.append({
            "symbol": stock["symbol"],
            "name": stock["name"],
            "points": points,
            "price_vs_trend": add_price_vs_trend(rows, reg),
        })

    return jsonify({
        "method": method,
        "series": series,
    })


@app.route("/api/update", methods=["POST"])
def api_update():
    return jsonify(update_all())


if __name__ == "__main__":
    init_db()
    results = update_all()
    for result in results:
        print(result)
    app.run(host="127.0.0.1", port=5005, debug=False)
