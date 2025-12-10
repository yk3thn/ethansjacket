const http = require("http");
const url = require("url");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

let currentState = {
  cmd: "off",
  speed: 60,
  brightness: 80,
  r: 255,
  g: 255,
  b: 255
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const { pathname, query } = parsed;

  if (pathname === "/set") {
    if (query.cmd) currentState.cmd = String(query.cmd);
    if (query.speed) currentState.speed = Number(query.speed);
    if (query.brightness) currentState.brightness = Number(query.brightness);
    if (query.r) currentState.r = Number(query.r);
    if (query.g) currentState.g = Number(query.g);
    if (query.b) currentState.b = Number(query.b);

    broadcastState();
    cors(res);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  if (pathname === "/state") {
    cors(res);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(currentState));
    return;
  }

  if (pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Ethan's Jacket Server is running.\n");
    return;
  }

  cors(res);
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

const wss = new WebSocket.Server({
  server,
  path: "/ws"
});

const espClients = new Set();

function broadcastState() {
  const payload = JSON.stringify(currentState);
  for (const ws of espClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

wss.on("connection", ws => {
  espClients.add(ws);
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(currentState));
  ws.on("close", () => espClients.delete(ws));
});

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
