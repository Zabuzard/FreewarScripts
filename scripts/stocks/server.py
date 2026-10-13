
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

TIME_RANGES = {
    "24h": ("24 Stunden", timedelta(hours=24)),
    "7d": ("7 Tage", timedelta(days=7)),
    "30d": ("30 Tage", timedelta(days=30)),
    "3m": ("3 Monate", timedelta(days=90)),
    "6m": ("6 Monate", timedelta(days=182)),
    "all": ("Gesamter Zeitraum", None),
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

    log.info("Inserted fake stock history for %d test companies", len(fake_companies))


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
                round(value, 2),
            ])
        except (TypeError, ValueError):
            continue

    return points


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

    return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# == HTML dashboard ==

def render_dashboard(query):
    stocks = get_latest_stocks()
    now = datetime.now(timezone.utc)
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

        # JSON contains numeric timestamps and values only.
        points_json = json.dumps(
            points,
            separators=(",", ":"),
        )

        cards.append(f"""
            <article class="card">
                <div class="card-header">
                    <div class="company">
                        <span class="id">#{company_id}</span>
                        <h2>{name}</h2>
                    </div>
                    <div class="current-value">{value_text}</div>
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
                    ></svg>
                    <div class="tooltip" hidden></div>
                </div>
                <div class="chart-footer">
                    <span>{len(points)} Datenpunkte</span>
                    <span>{html.escape(range_label)}</span>
                </div>
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
        --accent: #70ddb0;
        --grid: #28364b;
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

    header {{
        margin-bottom: 28px;
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
        margin: 26px 0 30px;
        padding: 18px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--panel);
    }}

    .control-label {{
        margin-bottom: 10px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 650;
    }}

    .ranges {{
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }}

    .range-button {{
        display: inline-block;
        padding: 9px 13px;
        border: 1px solid var(--border);
        border-radius: 9px;
        color: var(--text);
        text-decoration: none;
        font-size: 13px;
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
        gap: 12px;
        margin-top: 18px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
    }}

    .date-field {{
        display: grid;
        gap: 6px;
    }}

    .date-field label {{
        color: var(--muted);
        font-size: 12px;
    }}

    input[type="date"] {{
        min-height: 39px;
        padding: 7px 10px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg);
        color: var(--text);
        font: inherit;
    }}

    .submit-button {{
        min-height: 39px;
        padding: 8px 15px;
        border: 0;
        border-radius: 8px;
        background: #263b4b;
        color: var(--text);
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        font-weight: 650;
    }}

    .submit-button:hover {{
        background: #344e60;
    }}

    .range-summary {{
        margin-top: 12px;
        color: var(--muted);
        font-size: 12px;
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

    .current-value {{
        flex-shrink: 0;
        color: var(--accent);
        font-size: 23px;
        font-weight: 750;
        font-variant-numeric: tabular-nums;
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
        fill-opacity: .09;
    }}

    .chart .line {{
        fill: none;
        stroke: var(--accent);
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
    }}

    .chart .point {{
        fill: var(--accent);
        stroke: var(--panel);
        stroke-width: 2;
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

        .current-value {{
            margin-left: 34px;
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
            Historische Kursentwicklung aller Unternehmen.
        </div>
        <div class="status">
            <span class="dot"></span>
            Automatische Aktualisierung alle 5 Minuten
        </div>
    </header>

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

    <section class="grid">
        {cards_html}
    </section>

    <footer>
        Die Werte werden direkt von Freewar abgerufen.
        Die Diagramme zeigen aggregierte Kurswerte, wenn viele Messpunkte
        im gewählten Zeitraum liegen. Die Seite aktualisiert sich alle
        60 Sekunden.
    </footer>
</main>

<script>
(function () {{
    "use strict";

    const numberFormat = new Intl.NumberFormat("de-DE", {{
        maximumFractionDigits: 2
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

    function drawChart(svg) {{
        let points;

        try {{
            points = JSON.parse(svg.dataset.points || "[]");
        }} catch (error) {{
            points = [];
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

        let minValue = Math.min.apply(null, values);
        let maxValue = Math.max.apply(null, values);

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
            return left + ((timestamp - minTime) / timeSpan) * plotWidth;
        }}

        function yFor(value) {{
            return top + ((maxValue - value) / (maxValue - minValue)) * plotHeight;
        }}

        for (let i = 0; i <= 4; i++) {{
            const fraction = i / 4;
            const y = top + fraction * plotHeight;
            const value = maxValue - fraction * (maxValue - minValue);

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
