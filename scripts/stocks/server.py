import html
import json
import logging
import random
import re
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

# == Configuration ==

STOCKS_URL = "https://welt1.freewar.de/freewar/list_stocks.php"
POLL_INTERVAL = 300
DB_PATH = Path(__file__).resolve().parent / "data.db"
HOST = "0.0.0.0"
PORT = 8000
MAX_CHART_POINTS = 600
MEDIAN_WINDOW = 30
MIN_PERCENTILE = 5
MAX_PERCENTILE = 95

TIME_RANGES = {
    "24h": ("24 Stunden", timedelta(hours=24)),
    "7d": ("7 Tage", timedelta(days=7)),
    "30d": ("30 Tage", timedelta(days=30)),
    "3m": ("3 Monate", timedelta(days=90)),
    "6m": ("6 Monate", timedelta(days=182)),
    "all": ("Gesamt", None),
}

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
    """Insert temporary six-month history for the six test companies."""
    fake_companies = [
        (1, "Teidam Burger Corporation"),
        (2, "Herberge Vulkanblick Ag"),
        (3, "Bank aller Wesen"),
        (4, "Sandstaub Corporation"),
        (5, "Casino des Nordens Ag"),
        (6, "Post Corporation"),
    ]

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=182)

    with sqlite3.connect(DB_PATH, timeout=30) as db:
        db.executemany("""
            INSERT INTO companies (id, name)
            VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name
        """, fake_companies)

        rows = []
        timestamp = start

        while timestamp <= now:
            timestamp_text = timestamp.isoformat(timespec="seconds")

            for company_id, _ in fake_companies:
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
        len(fake_companies),
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
            ORDER BY c.id ASC
        """).fetchall()

    return [dict(row) for row in rows]


def get_chart_data(company_id, start, end, bucket_seconds):
    """Return time-bucketed data to keep charts responsive."""
    with sqlite3.connect(DB_PATH, timeout=30) as db:
        rows = db.execute("""
            SELECT
                MAX(timestamp) AS timestamp,
                AVG(value) AS value
            FROM stock_values
            WHERE company_id = ?
              AND timestamp >= ?
              AND timestamp <= ?
            GROUP BY CAST(
                (julianday(timestamp) - julianday(?)) * 86400 / ?
                AS INTEGER
            )
            ORDER BY MIN(timestamp)
        """, (
            company_id,
            start.isoformat(timespec="seconds"),
            end.isoformat(timespec="seconds"),
            start.isoformat(timespec="seconds"),
            bucket_seconds,
        )).fetchall()

    points = []

    for timestamp, value in rows:
        try:
            dt = datetime.fromisoformat(timestamp)
            points.append([
                int(dt.timestamp() * 1000),
                round(value),
            ])
        except (TypeError, ValueError):
            continue

    return points


def get_chart_stats(company_id, start, end):
    """Return percentile-based minimum/maximum and the exact median."""
    with sqlite3.connect(DB_PATH, timeout=30) as db:
        rows = db.execute("""
            SELECT value, timestamp
            FROM stock_values
            WHERE company_id = ?
              AND timestamp >= ?
              AND timestamp <= ?
            ORDER BY timestamp, id
        """, (
            company_id,
            start.isoformat(timespec="seconds"),
            end.isoformat(timespec="seconds"),
        )).fetchall()

    if not rows:
        return None

    sorted_rows = sorted(rows, key=lambda row: row[0])
    values = [row[0] for row in sorted_rows]
    count = len(values)

    def percentile(percent):
        position = (count - 1) * percent / 100
        lower_index = int(position)
        upper_index = min(lower_index + 1, count - 1)
        fraction = position - lower_index

        return round(
            values[lower_index] * (1 - fraction)
            + values[upper_index] * fraction
        )

    minimum = percentile(MIN_PERCENTILE)
    maximum = percentile(MAX_PERCENTILE)

    middle = count // 2

    if count % 2:
        median = values[middle]
    else:
        median = round((values[middle - 1] + values[middle]) / 2)

    return {
        "min": minimum,
        "max": maximum,
        "median": median,
    }


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


# == Dashboard helpers ==

def parse_date(value, fallback):
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
        return parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return fallback


def resolve_range(query):
    range_key = query.get("range", ["7d"])[0]

    if range_key not in TIME_RANGES:
        range_key = "7d"

    now = datetime.now(timezone.utc)
    custom_start = query.get("start", [""])[0]
    custom_end = query.get("end", [""])[0]

    if custom_start or custom_end:
        start = parse_date(
            custom_start,
            now - timedelta(days=7),
        )
        end_date = parse_date(custom_end, now)

        # Include the full selected end date.
        end = end_date + timedelta(days=1) - timedelta(seconds=1)

        if start > end:
            start, end = end, start

        if end > now:
            end = now

        label = "Benutzerdefiniert"
        return start, end, label, "custom", custom_start, custom_end

    label, duration = TIME_RANGES[range_key]
    start = now - duration if duration else None

    if start is None:
        with sqlite3.connect(DB_PATH, timeout=30) as db:
            row = db.execute(
                "SELECT MIN(timestamp) FROM stock_values"
            ).fetchone()

        if row and row[0]:
            start = datetime.fromisoformat(row[0])
        else:
            start = now - timedelta(days=182)

    return start, now, label, range_key, "", ""


def format_value(value):
    if value is None:
        return "Keine Daten"

    return f"{round(value):,}".replace(",", ".")


def format_signed_percent(value):
    rounded_value = round(value)

    if rounded_value > 0:
        return f"+{rounded_value}%"

    return f"{rounded_value}%"


def get_median_comparison(value, stats):
    """Express the distance from the median as a percentage of the typical range."""
    if value is None or not stats:
        return ""

    median = stats["median"]
    minimum = stats["min"]
    maximum = stats["max"]

    if value > median:
        typical_range = maximum - median

        if typical_range <= 0:
            return ""

        percentage = ((value - median) / typical_range) * 100
    elif value < median:
        typical_range = median - minimum

        if typical_range <= 0:
            return ""

        percentage = -((median - value) / typical_range) * 100
    else:
        percentage = 0

    return format_signed_percent(percentage)


# == HTML dashboard ==

def render_dashboard(query):
    stocks = get_latest_stocks()
    start, end, range_label, range_key, custom_start, custom_end = (
        resolve_range(query)
    )

    duration_seconds = max(60, (end - start).total_seconds())
    bucket_seconds = max(
        60,
        int(duration_seconds / MAX_CHART_POINTS),
    )

    range_buttons = []

    for key, (label, _) in TIME_RANGES.items():
        active = " active" if key == range_key else ""
        range_buttons.append(
            f'<a class="range-button{active}" href="/?range={key}">'
            f'{html.escape(label)}</a>'
        )

    cards = []

    for stock in stocks:
        company_id = stock["id"]
        name = html.escape(stock["name"])
        value = stock["value"]
        value_text = format_value(value)
        timestamp = stock["timestamp"] or ""

        if timestamp:
            latest_time = (
                f'<time class="local-time" '
                f'datetime="{html.escape(timestamp, quote=True)}">'
                f'{html.escape(timestamp)}</time>'
            )
        else:
            latest_time = "Noch nicht erfasst"

        points = get_chart_data(
            company_id,
            start,
            end,
            bucket_seconds,
        )
        stats = get_chart_stats(company_id, start, end)

        points_json = json.dumps(
            points,
            separators=(",", ":"),
        )
        stats_json = json.dumps(
            stats,
            separators=(",", ":"),
        )

        median_comparison = get_median_comparison(value, stats)

        if median_comparison:
            median_comparison_html = (
                f'<span class="median-comparison">{median_comparison}</span>'
            )
        else:
            median_comparison_html = ""

        cards.append(f"""
            <article class="card">
                <div class="card-header">
                    <div class="company">
                        <span class="id">#{company_id}</span>
                        <h2>{name}</h2>
                    </div>
                    <div class="current-value-wrap">
                        <div class="current-value">
                            <span class="current-value-number">{value_text}</span>
                            {median_comparison_html}
                            <span class="currency-symbol">🪙</span>
                        </div>
                    </div>
                </div>
                <div class="last-updated">
                    Letzter Kurs: {latest_time}
                </div>
                <div class="chart-wrap">
                    <svg
                        class="chart"
                        role="img"
                        aria-label="Kursverlauf: {name}"
                        viewBox="0 0 720 250"
                        data-points="{html.escape(points_json, quote=True)}"
                        data-stats="{html.escape(stats_json, quote=True)}"
                    ></svg>
                    <div class="tooltip" hidden></div>
                </div>
                <div class="chart-footer">
                    <span>{len(points)} Datenpunkte</span>
                    <span>{html.escape(range_label)}</span>
                </div>
                <div class="chart-stats"></div>
            </article>
        """)

    cards_html = "\n".join(cards) or """
        <div class="empty">
            Noch keine Unternehmen vorhanden.
        </div>
    """

    custom_start_value = html.escape(custom_start, quote=True)
    custom_end_value = html.escape(custom_end, quote=True)

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
        --accent: #65a9ff;
        --grid: #28364b;
        --median: #fca96a;
        --minimum: #ff6464;
        --maximum: #4ade80;
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
        max-width: 1400px;
        margin: auto;
        padding: 42px 22px;
    }}

    .header-layout {{
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 28px;
        margin-bottom: 30px;
    }}

    header {{
        flex: 1 1 auto;
        min-width: 0;
    }}

    .header-controls {{
        flex: 0 1 660px;
        min-width: 0;
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
        margin-top: 16px;
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

    .controls {{
        padding: 7px 10px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--panel);
    }}

    .control-label {{
        margin-bottom: 4px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 650;
    }}

    .ranges {{
        display: flex;
        flex-wrap: nowrap;
        gap: 6px;
        width: 100%;
    }}

    .range-button {{
        flex: 1 1 0;
        min-width: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 3px 7px;
        border: 1px solid var(--border);
        border-radius: 7px;
        color: var(--text);
        text-decoration: none;
        text-align: center;
        white-space: nowrap;
        font-size: 12px;
        line-height: 1.2;
        transition: background .15s, border-color .15s;
    }}

    .range-button:hover {{
        border-color: #49637f;
    }}

    .range-button.active {{
        border-color: var(--accent);
        background: var(--accent);
        color: #0b1120;
        font-weight: 700;
    }}

    .custom-range {{
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 8px;
        margin-top: 7px;
        padding-top: 7px;
        border-top: 1px solid var(--border);
    }}

    .date-field {{
        display: grid;
        gap: 3px;
    }}

    .date-field label {{
        color: var(--muted);
        font-size: 11px;
    }}

    input[type="date"] {{
        min-height: 25px;
        max-width: 100%;
        padding: 2px 6px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg);
        color: var(--text);
        font: inherit;
        font-size: 11px;
    }}

    .submit-button {{
        min-height: 25px;
        padding: 3px 8px;
        border: 0;
        border-radius: 6px;
        background: #263b4b;
        color: var(--text);
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        font-weight: 650;
    }}

    .submit-button:hover {{
        background: #344e60;
    }}

    .range-summary {{
        margin-top: 5px;
        color: var(--muted);
        font-size: 11px;
    }}

    .grid {{
        display: grid;
        grid-template-columns: repeat(
            auto-fit, minmax(min(100%, 440px), 1fr)
        );
        gap: 18px;
    }}

    .card {{
        min-width: 0;
        padding: 20px;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: var(--panel);
    }}

    .card-header {{
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
    }}

    .company {{
        display: flex;
        align-items: flex-start;
        gap: 10px;
        min-width: 0;
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
        font-weight: 650;
        line-height: 1.5;
        overflow-wrap: anywhere;
    }}

    .current-value-wrap {{
        flex-shrink: 0;
        text-align: right;
    }}

    .current-value {{
        display: flex;
        align-items: baseline;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 5px;
        color: var(--accent);
        font-size: 23px;
        font-weight: 750;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }}

    .current-value-number {{
        color: var(--accent);
    }}

    .median-comparison {{
        color: var(--muted);
        font-size: 13px;
        font-weight: 650;
    }}

    .currency-symbol {{
        color: inherit;
        font-size: 17px;
        font-weight: 400;
        filter: grayscale(1);
    }}

    .last-updated {{
        margin-top: 8px;
        color: var(--muted);
        font-size: 11px;
    }}

    .chart-wrap {{
        position: relative;
        margin-top: 18px;
    }}

    .chart {{
        display: block;
        width: 100%;
        overflow: visible;
    }}

    .chart .grid-line {{
        stroke: var(--grid);
        stroke-width: 1;
    }}

    .chart .axis-label {{
        fill: var(--muted);
        font-size: 10px;
    }}

    .chart .area {{
        fill: var(--accent);
        fill-opacity: .025;
    }}

    .chart .line {{
        fill: none;
        stroke: var(--accent);
        stroke-opacity: .55;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }}

    .chart .median-line {{
        fill: none;
        stroke: var(--median);
        stroke-width: 3.5;
        stroke-dasharray: 7 3;
        stroke-linecap: round;
        stroke-linejoin: round;
        filter: drop-shadow(0 0 1px #0b1120);
    }}

    .chart .point {{
        fill: var(--accent);
        fill-opacity: .7;
        stroke: var(--panel);
        stroke-width: 1.5;
    }}

    .chart .min-line {{
        stroke: var(--minimum);
        stroke-width: 2;
        stroke-dasharray: 5 4;
    }}

    .chart .max-line {{
        stroke: var(--maximum);
        stroke-width: 2;
        stroke-dasharray: 5 4;
    }}

    .chart .crosshair {{
        stroke: #b8c7dc;
        stroke-width: 1;
        stroke-dasharray: 4 4;
        pointer-events: none;
    }}

    .chart .hit-area {{
        fill: transparent;
        pointer-events: all;
        cursor: crosshair;
    }}

    .tooltip {{
        position: absolute;
        z-index: 2;
        top: 8px;
        left: 8px;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 9px;
        background: #0b1120;
        box-shadow: 0 8px 24px #0005;
        color: var(--text);
        font-size: 12px;
        line-height: 1.7;
        pointer-events: none;
        white-space: nowrap;
    }}

    .tooltip strong {{
        color: var(--accent);
        font-size: 14px;
    }}

    .chart-footer {{
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 8px;
        color: var(--muted);
        font-size: 11px;
    }}

    .chart-stats {{
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        margin-top: 12px;
        color: var(--muted);
        font-size: 12px;
    }}

    .chart-stats strong {{
        color: var(--text);
        font-variant-numeric: tabular-nums;
    }}

    .chart-stats .stat-min strong {{
        color: var(--minimum);
    }}

    .chart-stats .stat-max strong {{
        color: var(--maximum);
    }}

    .chart-stats .stat-median strong {{
        color: var(--median);
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
        margin-top: 30px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.8;
    }}

    @media (max-width: 1000px) {{
        .header-layout {{
            flex-direction: column;
        }}

        .header-controls {{
            flex: 1 1 auto;
            width: 100%;
        }}
    }}

    @media (max-width: 560px) {{
        main {{
            padding: 28px 14px;
        }}

        .card {{
            padding: 15px;
        }}

        .card-header {{
            flex-wrap: wrap;
        }}

        .current-value-wrap {{
            margin-left: 34px;
            text-align: left;
        }}

        .current-value {{
            justify-content: flex-start;
        }}

        .controls {{
            padding: 7px 8px;
        }}

        .ranges {{
            gap: 4px;
        }}

        .range-button {{
            padding: 3px 2px;
            font-size: 10px;
        }}
    }}
</style>
</head>
<body>
<main>
    <div class="header-layout">
        <header>
            <div class="eyebrow">Welt 1 · Marktdaten</div>
            <h1>Freewar-Aktienkurse</h1>
            <div class="subtitle">
                Historische Kursentwicklung aller Unternehmen.
            </div>
            <div class="status">
                <span class="dot"></span>
                Automatische Aktualisierung alle 5 Minuten
            </div>
        </header>

        <div class="header-controls">
            <section class="controls">
                <div class="control-label">Zeitraum auswählen</div>
                <nav class="ranges">
                    {"".join(range_buttons)}
                </nav>

                <form class="custom-range" action="/" method="get">
                    <input type="hidden" name="range" value="custom">
                    <div class="date-field">
                        <label for="start">Von</label>
                        <input
                            type="date"
                            id="start"
                            name="start"
                            value="{custom_start_value}"
                            required
                        >
                    </div>
                    <div class="date-field">
                        <label for="end">Bis</label>
                        <input
                            type="date"
                            id="end"
                            name="end"
                            value="{custom_end_value}"
                            required
                        >
                    </div>
                    <button class="submit-button" type="submit">
                        Zeitraum anwenden
                    </button>
                </form>

                <div class="range-summary">
                    Angezeigter Zeitraum:
                    <strong>{html.escape(range_label)}</strong>
                    · Alle Zeitangaben in deiner lokalen Zeitzone
                </div>
            </section>
        </div>
    </div>

    <section class="grid">
        {cards_html}
    </section>

    <footer>
        Die Werte werden direkt von Freewar abgerufen.
        Die Diagramme zeigen aggregierte Kurswerte, wenn viele Messpunkte
        im gewählten Zeitraum liegen. Die gestrichelte orange Linie
        (#fca96a) zeigt den gleitenden Median der dargestellten Datenpunkte
        (Fenster: {MEDIAN_WINDOW} Datenpunkte). Die rote Linie zeigt das
        5. Perzentil (Min (5%)), die grüne Linie das 95. Perzentil
        (Max (95%)) aller gespeicherten Messwerte des gewählten Zeitraums.
        Dadurch haben einzelne Ausreißer weniger Einfluss. Der Median in
        den Statistiken wird aus allen gespeicherten Messwerten berechnet.
        Die Prozentangabe neben dem aktuellen Kurs zeigt die Abweichung vom
        Median relativ zur jeweiligen typischen Spanne zwischen Median und
        5. beziehungsweise 95. Perzentil. Die Seite aktualisiert sich
        alle 60 Sekunden.
    </footer>
</main>

<script>
(function () {{
    "use strict";

    const MEDIAN_WINDOW = {MEDIAN_WINDOW};

    const numberFormat = new Intl.NumberFormat("de-DE", {{
        maximumFractionDigits: 0
    }});

    const dateFormat = new Intl.DateTimeFormat("de-DE", {{
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }});

    function createSvgElement(name, attributes, text) {{
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            name
        );

        Object.entries(attributes || {{}}).forEach(function (entry) {{
            element.setAttribute(entry[0], entry[1]);
        }});

        if (text !== undefined) {{
            element.textContent = text;
        }}

        return element;
    }}

    function getMedian(values) {{
        const sorted = values.slice().sort(function (a, b) {{
            return a - b;
        }});

        const middle = Math.floor(sorted.length / 2);

        if (sorted.length % 2) {{
            return sorted[middle];
        }}

        return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
    }}

    function drawChart(svg) {{
        let points;
        let stats;

        try {{
            points = JSON.parse(svg.dataset.points || "[]");
        }} catch (error) {{
            points = [];
        }}

        try {{
            stats = JSON.parse(svg.dataset.stats || "null");
        }} catch (error) {{
            stats = null;
        }}

        svg.replaceChildren();

        const width = 720;
        const height = 250;
        const left = 48;
        const right = 12;
        const top = 12;
        const bottom = 35;
        const plotWidth = width - left - right;
        const plotHeight = height - top - bottom;

        const statsContainer = svg.parentElement
            .parentElement.querySelector(".chart-stats");

        statsContainer.replaceChildren();

        if (stats) {{
            [
                ["Min (5%)", stats.min, "stat-min"],
                ["Median", stats.median, "stat-median"],
                ["Max (95%)", stats.max, "stat-max"]
            ].forEach(function (stat) {{
                const item = document.createElement("span");
                item.className = stat[2];

                const value = document.createElement("strong");
                value.textContent = numberFormat.format(stat[1]);

                item.append(
                    document.createTextNode(stat[0] + ": "),
                    value
                );

                statsContainer.appendChild(item);
            }});
        }}

        if (!points.length) {{
            svg.appendChild(createSvgElement("text", {{
                x: width / 2,
                y: height / 2,
                "text-anchor": "middle",
                fill: "#91a0b8",
                "font-size": "13"
            }}, "Keine Daten für diesen Zeitraum"));

            return;
        }}

        const values = points.map(function (point) {{
            return Number(point[1]);
        }});

        const timestamps = points.map(function (point) {{
            return Number(point[0]);
        }});

        let minValue = stats
            ? Number(stats.min)
            : Math.min.apply(null, values);
        let maxValue = stats
            ? Number(stats.max)
            : Math.max.apply(null, values);

        if (minValue === maxValue) {{
            minValue -= 1;
            maxValue += 1;
        }}

        const padding = (maxValue - minValue) * 0.12;
        minValue = Math.max(0, minValue - padding);
        maxValue += padding;

        const minTime = timestamps[0];
        const maxTime = timestamps[timestamps.length - 1];
        const timeSpan = Math.max(1, maxTime - minTime);

        function xFor(timestamp) {{
            return left +
                ((timestamp - minTime) / timeSpan) * plotWidth;
        }}

        function yFor(value) {{
            const clampedValue = Math.max(
                minValue,
                Math.min(maxValue, value)
            );

            return top +
                ((maxValue - clampedValue) / (maxValue - minValue)) *
                    plotHeight;
        }}

        for (let i = 0; i <= 4; i++) {{
            const fraction = i / 4;
            const y = top + fraction * plotHeight;
            const value = Math.round(
                maxValue - fraction * (maxValue - minValue)
            );

            svg.appendChild(createSvgElement("line", {{
                x1: left,
                y1: y,
                x2: width - right,
                y2: y,
                class: "grid-line"
            }}));

            svg.appendChild(createSvgElement("text", {{
                x: left - 8,
                y: y + 4,
                "text-anchor": "end",
                class: "axis-label"
            }}, numberFormat.format(value)));
        }}

        for (let i = 0; i <= 4; i++) {{
            const fraction = i / 4;
            const x = left + fraction * plotWidth;
            const timestamp = minTime + fraction * timeSpan;

            svg.appendChild(createSvgElement("text", {{
                x: x,
                y: height - 10,
                "text-anchor": i === 0
                    ? "start"
                    : i === 4
                        ? "end"
                        : "middle",
                class: "axis-label"
            }}, dateFormat.format(new Date(timestamp))));
        }}

        const coordinates = points.map(function (point) {{
            return {{
                x: xFor(Number(point[0])),
                y: yFor(Number(point[1])),
                timestamp: Number(point[0]),
                value: Number(point[1])
            }};
        }});

        const linePath = coordinates.map(function (point, index) {{
            return (index === 0 ? "M" : "L") +
                point.x.toFixed(2) + " " + point.y.toFixed(2);
        }}).join(" ");

        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        const areaPath = linePath +
            " L " + last.x + " " + (top + plotHeight) +
            " L " + first.x + " " + (top + plotHeight) + " Z";

        svg.appendChild(createSvgElement("path", {{
            d: areaPath,
            class: "area"
        }}));

        svg.appendChild(createSvgElement("path", {{
            d: linePath,
            class: "line"
        }}));

        coordinates.forEach(function (point) {{
            svg.appendChild(createSvgElement("circle", {{
                cx: point.x,
                cy: point.y,
                r: 2.5,
                class: "point"
            }}));
        }});

        const medianCoordinates = coordinates.map(function (point, index) {{
            const halfWindow = Math.floor(MEDIAN_WINDOW / 2);
            const windowStart = Math.max(
                0,
                Math.min(
                    index - halfWindow,
                    coordinates.length - MEDIAN_WINDOW
                )
            );
            const windowEnd = Math.min(
                coordinates.length,
                windowStart + MEDIAN_WINDOW
            );

            const windowValues = coordinates
                .slice(windowStart, windowEnd)
                .map(function (item) {{
                    return item.value;
                }});

            return {{
                x: point.x,
                y: yFor(getMedian(windowValues))
            }};
        }});

        const medianPath = medianCoordinates.map(function (point, index) {{
            return (index === 0 ? "M" : "L") +
                point.x.toFixed(2) + " " + point.y.toFixed(2);
        }}).join(" ");

        svg.appendChild(createSvgElement("path", {{
            d: medianPath,
            class: "median-line"
        }}));

        if (stats) {{
            [
                {{
                    value: stats.min,
                    className: "min-line"
                }},
                {{
                    value: stats.max,
                    className: "max-line"
                }}
            ].forEach(function (stat) {{
                const y = yFor(stat.value);

                svg.appendChild(createSvgElement("line", {{
                    x1: left,
                    y1: y,
                    x2: width - right,
                    y2: y,
                    class: stat.className
                }}));
            }});
        }}

        const marker = createSvgElement("circle", {{
            cx: first.x,
            cy: first.y,
            r: 4,
            class: "point",
            visibility: "hidden"
        }});

        const crosshair = createSvgElement("line", {{
            x1: first.x,
            y1: top,
            x2: first.x,
            y2: top + plotHeight,
            class: "crosshair",
            visibility: "hidden"
        }});

        svg.appendChild(crosshair);
        svg.appendChild(marker);

        const hitArea = createSvgElement("rect", {{
            x: left,
            y: top,
            width: plotWidth,
            height: plotHeight,
            class: "hit-area"
        }});

        svg.appendChild(hitArea);

        const tooltip = svg.parentElement.querySelector(".tooltip");

        function showPoint(event) {{
            const bounds = svg.getBoundingClientRect();
            const scaleX = width / bounds.width;
            const mouseX = (event.clientX - bounds.left) * scaleX;

            let nearest = coordinates[0];
            let distance = Infinity;

            coordinates.forEach(function (point) {{
                const currentDistance = Math.abs(point.x - mouseX);

                if (currentDistance < distance) {{
                    distance = currentDistance;
                    nearest = point;
                }}
            }});

            marker.setAttribute("cx", nearest.x);
            marker.setAttribute("cy", nearest.y);
            marker.setAttribute("visibility", "visible");

            crosshair.setAttribute("x1", nearest.x);
            crosshair.setAttribute("x2", nearest.x);
            crosshair.setAttribute("visibility", "visible");

            tooltip.replaceChildren();

            const value = document.createElement("strong");
            value.textContent = numberFormat.format(nearest.value);

            const date = document.createElement("div");
            date.textContent = dateFormat.format(
                new Date(nearest.timestamp)
            );

            tooltip.append(value, date);
            tooltip.hidden = false;

            const tooltipWidth = tooltip.offsetWidth;
            const relativeX = nearest.x / width * bounds.width;

            tooltip.style.left = Math.max(
                0,
                Math.min(
                    relativeX,
                    bounds.width - tooltipWidth
                )
            ) + "px";
        }}

        hitArea.addEventListener("pointermove", showPoint);

        hitArea.addEventListener("pointerleave", function () {{
            marker.setAttribute("visibility", "hidden");
            crosshair.setAttribute("visibility", "hidden");
            tooltip.hidden = true;
        }});

        if (coordinates.length === 1) {{
            marker.setAttribute("visibility", "visible");
        }}
    }}

    document.querySelectorAll(".chart").forEach(drawChart);
}})();
</script>
</body>
</html>"""


# == HTTP server ==

class StockHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlsplit(self.path)

        if parsed.path != "/":
            self.send_error(404, "Not Found")
            return

        query = parse_qs(parsed.query)

        try:
            page = render_dashboard(query).encode("utf-8")
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
