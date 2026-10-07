import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "valuaris.db"


def connect():
    DATA_DIR.mkdir(exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with connect() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS prices (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                close REAL NOT NULL,
                currency TEXT NOT NULL,
                PRIMARY KEY (symbol, date)
            );

            CREATE TABLE IF NOT EXISTS market_state (
                symbol TEXT PRIMARY KEY,
                last_market_date TEXT,
                last_checked_date TEXT
            );
            """
        )


def upsert_prices(symbol, currency, rows):
    with connect() as con:
        con.executemany(
            """
            INSERT INTO prices(symbol, date, close, currency)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(symbol, date) DO UPDATE SET
                close=excluded.close,
                currency=excluded.currency
            """,
            [(symbol, date, close, currency) for date, close in rows],
        )


def get_state(symbol):
    with connect() as con:
        row = con.execute(
            "SELECT last_market_date, last_checked_date FROM market_state WHERE symbol=?",
            (symbol,),
        ).fetchone()
    return dict(row) if row else {"last_market_date": None, "last_checked_date": None}


def set_state(symbol, last_market_date, last_checked_date):
    with connect() as con:
        con.execute(
            """
            INSERT INTO market_state(symbol, last_market_date, last_checked_date)
            VALUES (?, ?, ?)
            ON CONFLICT(symbol) DO UPDATE SET
                last_market_date=excluded.last_market_date,
                last_checked_date=excluded.last_checked_date
            """,
            (symbol, last_market_date, last_checked_date),
        )


def get_history(symbol):
    with connect() as con:
        rows = con.execute(
            "SELECT date, close, currency FROM prices WHERE symbol=? ORDER BY date",
            (symbol,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_latest(symbol):
    with connect() as con:
        row = con.execute(
            """
            SELECT date, close, currency
            FROM prices
            WHERE symbol=?
            ORDER BY date DESC
            LIMIT 1
            """,
            (symbol,),
        ).fetchone()
    return dict(row) if row else None
