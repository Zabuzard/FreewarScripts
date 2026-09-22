from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
import json
import queue
import threading

port = 8628
lastTimestamp = None
latestMessage = "Warten auf Events..."
lifepoints = 7000
eventHistory = []

clients = []
clientsLock = threading.Lock()
stateLock = threading.Lock()


def sendEvent(data):
  event = "data: " + json.dumps(data) + "\n\n"

  with clientsLock:
    currentClients = list(clients)

  print("Sending event:", data)

  for clientQueue in currentClients:
    clientQueue.put(event)


def addEvent(data):
  with stateLock:
    eventHistory.append(data)

    if len(eventHistory) > 100:
      eventHistory.pop(0)

  sendEvent(data)


class RequestHandler(BaseHTTPRequestHandler):
  def do_GET(self):
    global lastTimestamp
    global latestMessage
    global lifepoints

    parsed = urlparse(self.path)
    params = parse_qs(parsed.query)

    if parsed.path == "/baru-schreck":
      self.send_response(200)
      self.send_header("Content-Type", "text/html; charset=utf-8")
      self.send_header("Cache-Control", "no-cache")
      self.end_headers()

      with stateLock:
        historyJson = json.dumps(eventHistory)
        currentLifepoints = lifepoints

      html = """<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Baru-Schreck</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #111827;
      color: #f9fafb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .card {
      position: relative;
      width: min(600px, calc(100% - 32px));
      padding: 32px;
      background: #1f2937;
      border-radius: 16px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
    }

    .reset-button {
      position: absolute;
      top: 24px;
      right: 24px;
      padding: 8px 12px;
      background: #374151;
      color: #f9fafb;
      border: 1px solid #4b5563;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    }

    .reset-button:hover {
      background: #4b5563;
    }

    .title {
      margin: 0 0 24px;
      font-size: 24px;
      font-weight: 600;
    }

    .npc {
      display: flex;
      align-items: center;
      margin-bottom: 24px;
    }

    .npc img {
      width: 100px;
      height: 100px;
      object-fit: contain;
      margin-right: 20px;
    }

    .npc-name {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 600;
    }

    .npc-lifepoints {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .status {
      margin-bottom: 12px;
      color: #9ca3af;
      font-size: 14px;
    }

    .event-area {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .events {
      width: 50%;
      height: 105px;
      overflow-y: auto;
      padding: 6px 10px;
      background: #111827;
      border: 1px solid #374151;
      border-radius: 12px;
    }

    .event {
      padding: 3px 4px;
      font-size: 14px;
      line-height: 1.3;
    }

    .event-hit {
      color: #f9fafb;
    }

    .event-healed {
      color: #f9fafb;
      background: #8f6666;
      border-radius: 6px;
      margin: 2px 0;
    }

    .event-reset {
      color: #9ca3af;
    }

    .timer {
      width: 90px;
      text-align: center;
      font-size: 64px;
      line-height: 1;
      font-weight: 700;
      visibility: hidden;
    }

    .timer-warning {
      color: #e8a66a;
    }
  </style>
</head>
<body>
  <div class="card">
    <button class="reset-button" id="reset">Reset</button>

    <h1 class="title">Baru-Schreck</h1>

    <div class="npc">
      <img src="https://welt1.freewar.de/freewar/images/npcs/bschrecke.gif" alt="Baru-Schrecke">
      <div>
        <p class="npc-name">Baru-Schrecke</p>
        <p class="npc-lifepoints" id="lifepoints">Lebenspunkte: """ + format(currentLifepoints, ",").replace(",", ".") + """</p>
      </div>
    </div>

    <div class="status" id="status">Verbunden</div>

    <div class="event-area">
      <div class="events" id="events"></div>
      <div class="timer" id="timer">0</div>
    </div>
  </div>

  <script>
    var eventsContainer = document.getElementById("events");
    var status = document.getElementById("status");
    var lifepoints = document.getElementById("lifepoints");
    var reset = document.getElementById("reset");
    var timer = document.getElementById("timer");

    var eventHistoryData = """ + historyJson + """;
    var timerInterval = null;
    var timerEnd = 0;

    function formatLifepoints(value) {
      return value.toLocaleString("de-DE");
    }

    function addEvent(data) {
      var element = document.createElement("div");
      element.className = "event";

      if (data.type === "hit") {
        element.classList.add("event-hit");
        element.textContent = "Schlag von " + data.user;
      } else if (data.type === "healed") {
        element.classList.add("event-healed");
        element.textContent = "Baru-Schrecke heilt sich";
      } else if (data.type === "reset") {
        element.classList.add("event-reset");
        element.textContent = "System zurückgesetzt";
      } else {
        return;
      }

      eventsContainer.appendChild(element);

      while (eventsContainer.children.length > 100) {
        eventsContainer.removeChild(eventsContainer.firstChild);
      }

      eventsContainer.scrollTop = eventsContainer.scrollHeight;
    }

    function startTimer() {
      clearInterval(timerInterval);

      timer.classList.remove("timer-warning");
      timer.style.visibility = "visible";
      timerEnd = Date.now() + 4000;
      timer.textContent = "4";

      timerInterval = setInterval(function () {
        var remaining = Math.ceil((timerEnd - Date.now()) / 1000);

        if (remaining <= 0) {
          timer.textContent = "0";
          timer.classList.remove("timer-warning");
          timer.style.visibility = "hidden";
          clearInterval(timerInterval);
          timerInterval = null;
          return;
        }

        timer.textContent = remaining;

        if (remaining <= 2) {
          timer.classList.add("timer-warning");
        } else {
          timer.classList.remove("timer-warning");
        }
      }, 100);
    }

    for (var i = 0; i < eventHistoryData.length; i++) {
      addEvent(eventHistoryData[i]);
    }

    if (eventHistoryData.length > 0) {
      var lastEvent = eventHistoryData[eventHistoryData.length - 1];
      lifepoints.textContent = "Lebenspunkte: " + formatLifepoints(lastEvent.lifepoints);
    }

    var events = new EventSource("/baru-schreck/events");

    events.onopen = function () {
      status.textContent = "Verbunden";
      console.log("SSE connected");
    };

    events.onmessage = function (event) {
      console.log("SSE event:", event.data);

      var data = JSON.parse(event.data);

      if (data.type === "state") {
        lifepoints.textContent = "Lebenspunkte: " + formatLifepoints(data.lifepoints);
        return;
      }

      lifepoints.textContent = "Lebenspunkte: " + formatLifepoints(data.lifepoints);
      addEvent(data);

      if (data.type === "hit") {
        startTimer();
      } else if (data.type === "healed") {
        clearInterval(timerInterval);
        timerInterval = null;
        timer.textContent = "0";
        timer.classList.remove("timer-warning");
        timer.style.visibility = "hidden";
      }
    };

    events.onerror = function () {
      status.textContent = "Verbindung wird wiederhergestellt...";
      console.log("SSE connection error");
    };

    reset.onclick = function () {
      if (!confirm("System wirklich zurücksetzen?")) {
        return;
      }

      fetch("/baru-schreck/reset", {
        method: "GET"
      });
    };
  </script>
</body>
</html>"""

      self.wfile.write(html.encode("utf-8"))
      return

    if parsed.path == "/baru-schreck/events":
      clientQueue = queue.Queue()

      with clientsLock:
        clients.append(clientQueue)

      print("SSE client connected")

      self.send_response(200)
      self.send_header("Content-Type", "text/event-stream; charset=utf-8")
      self.send_header("Cache-Control", "no-cache")
      self.send_header("Connection", "keep-alive")
      self.end_headers()

      self.wfile.write(b": connected\n\n")
      self.wfile.flush()

      with stateLock:
        currentHistory = list(eventHistory)
        currentLifepoints = lifepoints

      for event in currentHistory:
        clientQueue.put("data: " + json.dumps(event) + "\n\n")

      clientQueue.put("data: " + json.dumps({
        "type": "state",
        "lifepoints": currentLifepoints
      }) + "\n\n")

      try:
        while True:
          data = clientQueue.get()
          self.wfile.write(data.encode("utf-8"))
          self.wfile.flush()
      except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
        pass
      finally:
        with clientsLock:
          if clientQueue in clients:
            clients.remove(clientQueue)

        print("SSE client disconnected")

      return

    if parsed.path == "/baru-schreck/hit":
      ts = params.get("ts", [None])[0]
      user = params.get("user", [None])[0]

      if ts is None or user is None:
        self.send_response(400)
        self.end_headers()
        return

      try:
        timestamp = int(ts)
      except ValueError:
        self.send_response(400)
        self.end_headers()
        return

      with stateLock:
        if lastTimestamp is not None and timestamp <= lastTimestamp:
          print("Ignoring old hit:", timestamp)
          self.send_response(200)
          self.end_headers()
          return

        lastTimestamp = timestamp
        lifepoints = max(0, lifepoints - 70)
        latestMessage = "Schlag von " + user

        data = {
          "type": "hit",
          "user": user,
          "lifepoints": lifepoints
        }

      print("Hit:", user, "ts:", timestamp, "lifepoints:", lifepoints)

      addEvent(data)

      self.send_response(200)
      self.end_headers()
      return

    if parsed.path == "/baru-schreck/healed":
      ts = params.get("ts", [None])[0]

      if ts is None:
        self.send_response(400)
        self.end_headers()
        return

      try:
        timestamp = int(ts)
      except ValueError:
        self.send_response(400)
        self.end_headers()
        return

      with stateLock:
        if lastTimestamp is not None and timestamp <= lastTimestamp:
          print("Ignoring old heal:", timestamp)
          self.send_response(200)
          self.end_headers()
          return

        lastTimestamp = timestamp
        lifepoints = 7000
        latestMessage = "Baru-Schrecke heilt sich"

        data = {
          "type": "healed",
          "lifepoints": lifepoints
        }

      print("Healed: ts:", timestamp, "lifepoints:", lifepoints)

      addEvent(data)

      self.send_response(200)
      self.end_headers()
      return

    if parsed.path == "/baru-schreck/reset":
      with stateLock:
        lifepoints = 7000
        latestMessage = "Warten auf Events..."

        data = {
          "type": "reset",
          "lifepoints": lifepoints
        }

      print("System reset: lifepoints:", lifepoints)

      addEvent(data)

      self.send_response(200)
      self.end_headers()
      return

    self.send_response(404)
    self.end_headers()

  def log_message(self, format, *args):
    return


server = ThreadingHTTPServer(("localhost", port), RequestHandler)
print("Baru-Schreck server listening on http://localhost:" + str(port))

try:
  server.serve_forever()
except KeyboardInterrupt:
  print("\nShutting down...")
  server.server_close()
