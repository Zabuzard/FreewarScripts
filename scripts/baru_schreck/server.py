from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

port = 8628

class RequestHandler(BaseHTTPRequestHandler):
  def do_GET(self):
    parsed = urlparse(self.path)

    if parsed.path == "/baru-schreck/hit":
      params = parse_qs(parsed.query)
      user = params.get("user", [None])[0]

      print("Hit:", user)

      self.send_response(200)
      self.end_headers()
      return

    if parsed.path == "/baru-schreck/healed":
      print("Baru-Schrecke healed")

      self.send_response(200)
      self.end_headers()
      return

    self.send_response(404)
    self.end_headers()

  def log_message(self, format, *args):
    return

server = HTTPServer(("localhost", port), RequestHandler)
print("Baru-Schreck server listening on http://localhost:" + str(port))
try:
  server.serve_forever()
except KeyboardInterrupt:
  print("\nShutting down...")
  server.server_close()
