import json
from datetime import date, datetime, timedelta
from pathlib import Path

import yfinance as yf

from db import get_state, init_db, set_state, upsert_prices

ROOT = Path(__file__).resolve().parent
STOCKS_FILE = ROOT / "stocks.json"
HISTORY_YEARS = 20


def load_stocks():
    return json.loads(STOCKS_FILE.read_text(encoding="utf-8"))


def _download(symbol, start, end):
    ticker = yf.Ticker(symbol)
    frame = ticker.history(
        start=start.isoformat(),
        end=(end + timedelta(days=1)).isoformat(),
        interval="1d",
        auto_adjust=False,
        actions=True,
        repair=True,
    )
    if frame.empty:
        return []

    frame = frame.dropna(subset=["Close"])
    return [(idx.date().isoformat(), float(row["Close"])) for idx, row in frame.iterrows()]


def update_stock(stock, today=None, force=False):
    today = today or date.today()
    symbol = stock["symbol"]
    currency = stock["currency"]
    state = get_state(symbol)

    if not force and state["last_checked_date"] == today.isoformat():
        return {
            "symbol": symbol,
            "status": "already_checked",
            "last_market_date": state["last_market_date"],
            "new_rows": 0,
        }

    if state["last_market_date"]:
        start = datetime.strptime(state["last_market_date"], "%Y-%m-%d").date() + timedelta(days=1)
    else:
        try:
            start = today.replace(year=today.year - HISTORY_YEARS)
        except ValueError:
            start = today.replace(year=today.year - HISTORY_YEARS, day=28)

    rows = []
    if start <= today:
        rows = _download(symbol, start, today)
        if rows:
            upsert_prices(symbol, currency, rows)

    last_market_date = rows[-1][0] if rows else state["last_market_date"]
    set_state(symbol, last_market_date, today.isoformat())

    return {
        "symbol": symbol,
        "status": "updated",
        "last_market_date": last_market_date,
        "new_rows": len(rows),
    }


def update_all(force=False):
    init_db()
    results = []
    for stock in load_stocks():
        if stock.get("enabled", True):
            try:
                results.append(update_stock(stock, force=force))
            except Exception as exc:
                results.append({
                    "symbol": stock["symbol"],
                    "status": "error",
                    "error": f"{type(exc).__name__}: {exc}",
                })
    return results


if __name__ == "__main__":
    for result in update_all():
        print(result)
