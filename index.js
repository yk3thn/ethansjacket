import express from "express";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 8080;

// Express HTTP server (for future usage if needed)
const app = express();
const server = app.listen(PORT, () =>
  console.log("Server running on port", PORT)
);

// WebSocket Server
const wss = new WebSocketServer({ server });

let espClient = null;     // The ESP8266 connection
let webClients = [];      // Browsers connected to UI
let currentState = {
  cmd: "off",
  r: 0,
  g: 0,
  b: 0,
  speed: 50,
  brightness: 100
};

// Handle WebSocket Connections
wss.on("connection", (ws, req) => {
  const url = req.url;

  if (url === "/esp") {
    console.log("ESP connected");
    espClient = ws;

    ws.send(JSON.stringify({ type: "state", data: currentState }));

    ws.on("close", () => {
      console.log("ESP disconnected");
      espClient = null;
    });

  } else if (url === "/web") {
    console.log("Web UI connected");
    webClients.push(ws);

    ws.send(JSON.stringify({ type: "state", data: currentState }));

    ws.on("close", () => {
      webClients = webClients.filter(c => c !== ws);
    });

    ws.on("message", msg => {
      const data = JSON.parse(msg);

      currentState = { ...currentState, ...data };

      if (espClient && espClient.readyState === 1)
        espClient.send(JSON.stringify(currentState));

      webClients.forEach(c => {
        if (c !== ws)
          c.send(JSON.stringify({ type: "state", data: currentState }));
      });
    });
  }
});

// Root page (to prevent 404)
app.get("/", (req, res) => {
  res.send("WebSocket LED Server is running.");
});
