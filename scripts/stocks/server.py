
import html
import logging
import random
import re
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

# == Configuration ==

STOCKS_URL = "https://welt1.freewar.de/freewar/list_stocks.php"
POLL_INTERVAL = 300
DB_PATH = Path(__file__).resolve().parent / "data.db"
HOST = "0.0.0.0"
PORT = 8000

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("stocks")


# == Database ==

def init_db():
    is_fresh = not DB_PATH.exists()

    with sqlite3.connect(DB_PATH, timeout=30) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("""
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS stock_values (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                value INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (company_id) REFERENCES companies(id)
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_stock_company_time
            ON stock_values(company_id, timestamp DESC, id DESC)
        """)

    if is_fresh:
        seed_fake_data()


def seed_fake_data():
    """Insert temporary historical data for the six test companies."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=182)

    companies = [
        (1, "Teidam Burger Corporation"),
        (2, "Herberge Vulkanblick Ag"),
        (3, "Bank aller Wesen"),
        (4, "Sandstaub Corporation"),
        (5, "Casino des Nordens Ag"),
        (6, "Post Corporation"),
    ]

    with sqlite3.connect(DB_PATH, timeout=30) as db:
        db.executemany("""
            INSERT INTO companies (id, name)
            VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name
        """, companies)

        rows = []
        timestamp = start

        while timestamp <= now:
            timestamp_text = timestamp.isoformat(timespec="seconds")

            for company_id, _ in companies:
                rows.append((
                    company_id,
                    random.randint(300, 600),
                    timestamp_text,
                ))

            timestamp += timedelta(minutes=5)

            if len(rows) >= 5000:
                db.executemany("""
                    INSERT INTO stock_values
                        (company_id, value, timestamp)
                    VALUES (?, ?, ?)
                """, rows)
                rows.clear()

        if rows:
            db.executemany("""
                INSERT INTO stock_values
                    (company_id, value, timestamp)
                VALUES (?, ?, ?)
            """, rows)

    log.info(
        "Inserted fake stock history for %d test companies",
        len(companies),
    )


def save_stocks(stocks):
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")

    with sqlite3.connect(DB_PATH, timeout=30) as db:
        db.execute("PRAGMA foreign_keys=ON")

        db.executemany("""
            INSERT INTO companies (id, name)
            VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name
        """, [
            (company_id, name)
            for company_id, name, _ in stocks
        ])

        db.executemany("""
            INSERT INTO stock_values (company_id, value, timestamp)
            VALUES (?, ?, ?)
        """, [
            (company_id, value, timestamp)
            for company_id, _, value in stocks
        ])

    log.info("Saved %d stock values", len(stocks))


def get_latest_stocks():
    with sqlite3.connect(DB_PATH, timeout=30) as db:
        db.row_factory = sqlite3.Row
        rows = db.execute("""
            SELECT c.id, c.name, s.value, s.timestamp
            FROM companies c
            LEFT JOIN stock_values s ON s.id = (
                SELECT sv.id
                FROM stock_values sv
                WHERE sv.company_id = c.id
                ORDER BY sv.timestamp DESC, sv.id DESC
                LIMIT 1
            )
            ORDER BY c.name COLLATE NOCASE
        """).fetchall()

    return [dict(row) for row in rows]


# == Stock collector ==

def parse_stocks(source):
    source = html.unescape(re.sub(r"<[^>]*>", "", source))
    stocks = []

    for line in source.splitlines():
        line = line.strip()
        if not line:
            continue

        match = re.match(r"^(\d+)\s+(.+?)\s+(\d+)$", line)
        if not match:
            log.warning("Skipping invalid stock line: %r", line)
            continue

        company_id = int(match.group(1))
        name = match.group(2).strip()
        value = int(match.group(3))

        if name:
            stocks.append((company_id, name, value))

    return stocks


def collect_stocks():
    request = Request(
        STOCKS_URL,
        headers={"User-Agent": "FreewarStockTracker/1.0"},
    )

    with urlopen(request, timeout=30) as response:
        source = response.read().decode("utf-8", errors="replace")

    stocks = parse_stocks(source)

    if not stocks:
        raise ValueError("No valid stock data received")

    save_stocks(stocks)


def stock_collector():
    while True:
        try:
            collect_stocks()
        except Exception:
            log.exception("Stock collection failed")

        time.sleep(POLL_INTERVAL)


# == HTML dashboard ==

def render_dashboard():
    stocks = get_latest_stocks()
    cards = []

    for stock in stocks:
        name = html.escape(stock["name"])
        value = stock["value"]
        value_text = (
            f"{value:,}".replace(",", ".")
            if value is not None
            else "Keine Daten"
        )
        timestamp = html.escape(stock["timestamp"] or "")

        if timestamp:
            time_display = (
                f'<time class="local-time" datetime="{timestamp}">'
                f'{timestamp}</time>'
            )
        else:
            time_display = "Noch nicht erfasst"

        cards.append(f"""
            <article class="card">
                <div class="company">
                    <span class="id">#{stock["id"]}</span>
                    <h2>{name}</h2>
                </div>
                <div class="value">{value_text}</div>
                <div class="time">{time_display}</div>
            </article>
        """)

    cards_html = "\n".join(cards) or """
        <div class="empty">
            Warte auf die erste Kurserfassung ...
        </div>
    """

    return f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60">
<title>Freewar-Aktienkurse</title>
<style>
    :root {{
        color-scheme: dark;
        --bg: #0b1120;
        --panel: #141e30;
        --border: #28364b;
        --text: #edf2fa;
        --muted: #91a0b8;
        --accent: #70ddb0;
    }}

    * {{
        box-sizing: border-box;
    }}

    body {{
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: system-ui, sans-serif;
    }}

    main {{
        max-width: 1100px;
        margin: auto;
        padding: 48px 20px;
    }}

    header {{
        margin-bottom: 32px;
    }}

    .eyebrow {{
        color: var(--accent);
        font-size: 12px;
        font-weight: 750;
        letter-spacing: .16em;
        text-transform: uppercase;
    }}

    h1 {{
        margin: 10px 0;
        font-size: clamp(30px, 5vw, 44px);
        letter-spacing: -.04em;
    }}

    .subtitle {{
        color: var(--muted);
    }}

    .status {{
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 18px;
        padding: 7px 11px;
        border: 1px solid var(--border);
        border-radius: 99px;
        color: var(--muted);
        font-size: 12px;
    }}

    .dot {{
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--accent);
    }}

    .grid {{
        display: grid;
        grid-template-columns: repeat(
            auto-fit, minmax(min(100%, 240px), 1fr)
        );
        gap: 16px;
    }}

    .card {{
        min-width: 0;
        padding: 22px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--panel);
        transition: border-color .15s, transform .15s;
    }}

    .card:hover {{
        border-color: #49637f;
        transform: translateY(-2px);
    }}

    .company {{
        display: flex;
        align-items: flex-start;
        gap: 10px;
        min-height: 48px;
    }}

    .id {{
        flex-shrink: 0;
        padding: 4px 7px;
        border-radius: 6px;
        background: #233149;
        color: #b8c7dc;
        font-size: 11px;
        font-weight: 700;
    }}

    h2 {{
        margin: 1px 0 0;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.5;
        overflow-wrap: anywhere;
    }}

    .value {{
        margin-top: 22px;
        font-size: 36px;
        font-weight: 750;
        letter-spacing: -.04em;
        font-variant-numeric: tabular-nums;
    }}

    .time {{
        margin-top: 9px;
        color: var(--muted);
        font-size: 11px;
        overflow-wrap: anywhere;
    }}

    .empty {{
        grid-column: 1 / -1;
        padding: 36px;
        border: 1px dashed var(--border);
        border-radius: 16px;
        color: var(--muted);
        text-align: center;
    }}

    footer {{
        margin-top: 32px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.8;
    }}

    @media (max-width: 500px) {{
        main {{
            padding: 32px 16px;
        }}

        .card {{
            padding: 18px;
        }}
    }}
</style>
</head>
<body>
<main>
    <header>
        <div class="eyebrow">Welt 1 · Marktdaten</div>
        <h1>Freewar-Aktienkurse</h1>
        <div class="subtitle">
            Aktuelle Aktienwerte aller Unternehmen.
        </div>
        <div class="status">
            <span class="dot"></span>
            Automatische Aktualisierung alle 5 Minuten
        </div>
    </header>

    <section class="grid">
        {cards_html}
    </section>

    <footer>
        Die Werte werden direkt von Freewar abgerufen.
        Zeitangaben werden in deiner lokalen Zeitzone angezeigt.
        Diese Seite aktualisiert sich alle 60 Sekunden.
    </footer>
</main>

<script>
    document.querySelectorAll(".local-time").forEach(function (element) {{
        const date = new Date(element.dateTime);

        if (!Number.isNaN(date.getTime())) {{
            element.textContent = new Intl.DateTimeFormat("de-DE", {{
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23",
                timeZoneName: "short"
            }}).format(date);
        }}
    }});
</script>
</body>
</html>"""


# == HTTP server ==

class StockHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/":
            self.send_error(404, "Not Found")
            return

        try:
            page = render_dashboard().encode("utf-8")
        except Exception:
            log.exception("Failed to render dashboard")
            self.send_error(500, "Internal Server Error")
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(page)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(page)

    def log_message(self, format_string, *args):
        log.info(
            "%s - %s",
            self.address_string(),
            format_string % args,
        )


# == Startup ==

def main():
    init_db()

    threading.Thread(
        target=stock_collector,
        name="stock-collector",
        daemon=True,
    ).start()

    server = ThreadingHTTPServer((HOST, PORT), StockHandler)
    log.info("Server listening on http://%s:%d", HOST, PORT)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Shutting down")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
