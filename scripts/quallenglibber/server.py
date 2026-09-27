from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
import json
import queue
import threading

port = 80
lastTimestamp = None
lifepoints = 8000
lastUser = None
protection = False
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
    global lifepoints
    global lastUser
    global protection

    parsed = urlparse(self.path)
    params = parse_qs(parsed.query)

    if parsed.path == "/quallenglibber":
      self.send_response(200)
      self.send_header("Content-Type", "text/html; charset=utf-8")
      self.send_header("Cache-Control", "no-cache")
      self.end_headers()

      with stateLock:
        historyJson = json.dumps(eventHistory)
        currentLifepoints = lifepoints
        currentLastUser = lastUser
        currentProtection = protection

      html = """<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quallenglibber</title>
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
      background: #374151;
      border-radius: 6px;
      margin: 2px 0;
    }

    .event-protection-active {
      color: #f9fafb;
      background: #8f6666;
      border-radius: 6px;
      margin: 2px 0;
    }

    .event-protection-inactive {
      color: #f9fafb;
      background: #42634a;
      border-radius: 6px;
      margin: 2px 0;
    }

    .event-reset {
      color: #9ca3af;
    }

    .info {
      width: 50%;
      height: 105px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 10px;
    }

    .last-user {
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 12px;
      background: #374151;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      text-align: center;
    }

    .protection {
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 12px;
      background: #374151;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      text-align: center;
    }

    .protection-active {
      background: #8f6666;
    }

    .clear-button {
      margin-left: 8px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #9ca3af;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
    }

    .clear-button:hover {
      color: #f9fafb;
    }
  </style>
</head>
<body>
  <div class="card">
    <button class="reset-button" id="reset">Reset</button>

    <h1 class="title">Quallenglibber</h1>

    <div class="npc">
      <img src="https://welt1.freewar.de/freewar/images/npcs/kanalqualle.gif" alt="massive Landqualle">
      <div>
        <p class="npc-name">massive Landqualle</p>
        <p class="npc-lifepoints" id="lifepoints">Lebenspunkte: """ + format(currentLifepoints, ",").replace(",", ".") + """</p>
      </div>
    </div>

    <div class="status" id="status">Verbunden</div>

    <div class="event-area">
      <div class="events" id="events"></div>

      <div class="info">
        <div class="last-user" id="last-user">Kein letzter Schlag</div>
        <div class="protection" id="protection">🛡 keiner</div>
      </div>
    </div>
  </div>

  <script>
    var eventsContainer = document.getElementById("events");
    var status = document.getElementById("status");
    var lifepoints = document.getElementById("lifepoints");
    var lastUserElement = document.getElementById("last-user");
    var protectionElement = document.getElementById("protection");
    var reset = document.getElementById("reset");

    var eventHistoryData = """ + historyJson + """;

    var userColors = {};
    var usedColors = {};

    function formatLifepoints(value) {
      return value.toLocaleString("de-DE");
    }

    function getUserColor(user) {
      if (userColors[user]) {
        return userColors[user];
      }

      var colors = [
        "#5b3f6b",
        "#3f5b6b",
        "#6b3f45",
        "#536b3f",
        "#6b533f",
        "#3f6b61",
        "#63403f",
        "#3f476b",
        "#6b643f",
        "#3f6b4a",
        "#6b3f62",
        "#4f5f6b",
        "#5f6b4f",
        "#6b4f5f",
        "#4f6b67",
        "#594f6b"
      ];

      var hash = 2166136261;

      for (var i = 0; i < user.length; i++) {
        hash ^= user.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }

      hash >>>= 0;

      var startIndex = hash % colors.length;
      var color = null;

      for (var i = 0; i < colors.length; i++) {
        var index = (startIndex + i) % colors.length;

        if (!usedColors[colors[index]]) {
          color = colors[index];
          break;
        }
      }

      if (!color) {
        color = colors[startIndex];
      }

      userColors[user] = color;
      usedColors[color] = true;

      return color;
    }

    function updateLastUser(user) {
      if (!user) {
        lastUserElement.textContent = "Kein letzter Schlag";
        lastUserElement.style.backgroundColor = "#374151";
        return;
      }

      lastUserElement.textContent = "⚔ " + user;
      lastUserElement.style.backgroundColor = getUserColor(user);
    }

    function updateProtection(active) {
      protectionElement.innerHTML = "";

      var text = document.createElement("span");
      text.textContent = active ? "🛡 Schutz" : "🛡 keiner";

      protectionElement.appendChild(text);

      if (active) {
        var clear = document.createElement("button");
        clear.className = "clear-button";
        clear.textContent = "×";
        clear.title = "Schutzstatus löschen";

        clear.onclick = function () {
          protectionElement.innerHTML = "";
          protectionElement.textContent = "🛡 keiner";
          protectionElement.classList.remove("protection-active");
        };

        protectionElement.appendChild(clear);
        protectionElement.classList.add("protection-active");
      } else {
        protectionElement.classList.remove("protection-active");
      }
    }

    function addEvent(data) {
      var element = document.createElement("div");
      element.className = "event";

      if (data.type === "hit") {
        element.classList.add("event-hit");
        element.textContent = "Schlag von " + data.user;
      } else if (data.type === "healed") {
        element.classList.add("event-healed");
        element.textContent = "massive Landqualle heilt sich";
      } else if (data.type === "protection") {
        if (data.active) {
          element.classList.add("event-protection-active");
          element.textContent = "Schutz aktiviert";
        } else {
          element.classList.add("event-protection-inactive");
          element.textContent = "Schutz deaktiviert";
        }
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

    for (var i = 0; i < eventHistoryData.length; i++) {
      addEvent(eventHistoryData[i]);
    }

    if (eventHistoryData.length > 0) {
      var lastEvent = eventHistoryData[eventHistoryData.length - 1];

      lifepoints.textContent = "Lebenspunkte: " + formatLifepoints(lastEvent.lifepoints);

      for (var i = eventHistoryData.length - 1; i >= 0; i--) {
        if (eventHistoryData[i].type === "hit") {
          updateLastUser(eventHistoryData[i].user);
          break;
        }
      }

      for (var i = eventHistoryData.length - 1; i >= 0; i--) {
        if (eventHistoryData[i].type === "protection") {
          updateProtection(eventHistoryData[i].active);
          break;
        }
      }
    }

    var events = new EventSource("/quallenglibber/events");

    events.onopen = function () {
      status.textContent = "Verbunden";
      console.log("SSE connected");
    };

    events.onmessage = function (event) {
      console.log("SSE event:", event.data);

      var data = JSON.parse(event.data);

      if (data.type === "state") {
        lifepoints.textContent = "Lebenspunkte: " + formatLifepoints(data.lifepoints);
        updateLastUser(data.lastUser);
        updateProtection(data.protection);
        return;
      }

      lifepoints.textContent = "Lebenspunkte: " + formatLifepoints(data.lifepoints);
      addEvent(data);

      if (data.type === "hit") {
        updateLastUser(data.user);
      } else if (data.type === "protection") {
        updateProtection(data.active);
      } else if (data.type === "reset") {
        updateLastUser(null);
        updateProtection(false);
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

      fetch("/quallenglibber/reset", {
        method: "GET"
      });
    };
  </script>
</body>
</html>"""

      self.wfile.write(html.encode("utf-8"))
      return

    if parsed.path == "/quallenglibber/events":
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
        currentLastUser = lastUser
        currentProtection = protection

      for event in currentHistory:
        clientQueue.put("data: " + json.dumps(event) + "\n\n")

      clientQueue.put("data: " + json.dumps({
        "type": "state",
        "lifepoints": currentLifepoints,
        "lastUser": currentLastUser,
        "protection": currentProtection
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

    if parsed.path == "/quallenglibber/hit":
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
        lifepoints = max(0, lifepoints - 100)
        lastUser = user

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

    if parsed.path == "/quallenglibber/healed":
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
        lifepoints = 8000

        data = {
          "type": "healed",
          "lifepoints": lifepoints
        }

      print("Healed: ts:", timestamp, "lifepoints:", lifepoints)

      addEvent(data)

      self.send_response(200)
      self.end_headers()
      return

    if parsed.path == "/quallenglibber/protection":
      ts = params.get("ts", [None])[0]
      active = params.get("active", [None])[0]

      if ts is None or active is None:
        self.send_response(400)
        self.end_headers()
        return

      if active not in ("0", "1"):
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
          print("Ignoring old protection event:", timestamp)
          self.send_response(200)
          self.end_headers()
          return

        lastTimestamp = timestamp
        protection = active == "1"

        data = {
          "type": "protection",
          "active": protection,
          "lifepoints": lifepoints
        }

      print("Protection:", protection, "ts:", timestamp)

      addEvent(data)

      self.send_response(200)
      self.end_headers()
      return

    if parsed.path == "/quallenglibber/reset":
      with stateLock:
        lifepoints = 8000
        lastUser = None
        protection = False

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


server = ThreadingHTTPServer(("0.0.0.0", port), RequestHandler)
print("Quallenglibber server listening on http://0.0.0.0:" + str(port))

try:
  server.serve_forever()
except KeyboardInterrupt:
  print("\nShutting down...")
  server.server_close()
