import json
from pathlib import Path

import yfinance as yf


ROOT = Path(__file__).resolve().parent.parent
STOCKS_FILE = ROOT / "stocks.json"


def main():
    stocks = json.loads(STOCKS_FILE.read_text(encoding="utf-8"))

    for stock in stocks:
        if not stock.get("enabled", True):
            continue

        symbol = stock["symbol"]
        name = stock["name"]

        print(f"\n{name} ({symbol})")
        print("-" * 60)

        ticker = yf.Ticker(symbol)

        # Yahoo/yfinance:
        # - auto_adjust=False keeps Close and Adj Close as separate columns.
        # - Close is what we want to inspect for the first Mr. Market test.
        # - repair=True asks yfinance to repair known Yahoo price/currency issues.
        try:
            history = ticker.history(
                period="max",
                interval="1d",
                auto_adjust=False,
                actions=True,
                repair=True,
            )
        except Exception as exc:
            print(f"ERROR: {type(exc).__name__}: {exc}")
            continue

        if history.empty:
            print("No data returned.")
            continue

        history = history.dropna(subset=["Close"])

        first_date = history.index[0].date()
        last_date = history.index[-1].date()
        latest_close = float(history["Close"].iloc[-1])
        latest_adj_close = float(history["Adj Close"].iloc[-1])

        splits = history["Stock Splits"]
        splits = splits[splits != 0]

        print(f"Rows:              {len(history):,}")
        print(f"First date:        {first_date}")
        print(f"Last date:         {last_date}")
        print(f"Latest Close:      {latest_close:,.4f}")
        print(f"Latest Adj Close:  {latest_adj_close:,.4f}")
        print(f"Stock splits seen: {len(splits)}")

        if len(splits):
            print("Recent splits:")
            for date, value in splits.tail(5).items():
                print(f"  {date.date()}: {value:g}")


if __name__ == "__main__":
    main()
