const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

// ===== GLOBAL STATE =====
let currentState = {

  // LIGHT JACKET
  cmd: "off",
  speed: 60,
  brightness: 80,
  r: 255,
  g: 255,
  b: 255,
  c1r: 0, c1g: 0, c1b: 255,
  c2r: 255, c2g: 0, c2b: 255,
  led: 0,      // LED the "Map LEDs" tool is pointing at
  face: [],    // LEDs that make the jack-o'-lantern face
  bgr: 25, bgg: 6, bgb: 0,   // jack-o'-lantern background (dim pumpkin orange)

  // MOTOR JACKET
  motorsEnabled: true,
  motorA: { speed: 0, dir: "cw" },
  motorB: { speed: 0, dir: "cw" }
};

function cors(res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
}

const server=http.createServer((req,res)=>{
  const parsed=url.parse(req.url,true);
  const {pathname,query}=parsed;

  // ===== LIGHT JACKET ENDPOINT =====
  if(pathname==="/set"){

    if(query.cmd && query.cmd!=="keep")
      currentState.cmd=String(query.cmd);

    if(query.speed) currentState.speed=Number(query.speed);
    if(query.brightness) currentState.brightness=Number(query.brightness);

    if(query.r) currentState.r=Number(query.r);
    if(query.g) currentState.g=Number(query.g);
    if(query.b) currentState.b=Number(query.b);

    if(query.c1r) currentState.c1r=Number(query.c1r);
    if(query.c1g) currentState.c1g=Number(query.c1g);
    if(query.c1b) currentState.c1b=Number(query.c1b);
    if(query.c2r) currentState.c2r=Number(query.c2r);
    if(query.c2g) currentState.c2g=Number(query.c2g);
    if(query.c2b) currentState.c2b=Number(query.c2b);

    if(query.bgr) currentState.bgr=Number(query.bgr);
    if(query.bgg) currentState.bgg=Number(query.bgg);
    if(query.bgb) currentState.bgb=Number(query.bgb);

    // LED mapper (led=0 is a real LED, so check for undefined, not truthy)
    if(query.led!==undefined) currentState.led=Number(query.led);
    if(query.face!==undefined)
      currentState.face=String(query.face).split(",").filter(s=>s!=="").map(Number).filter(Number.isInteger);

    broadcastState();

    cors(res);
    res.writeHead(200,{"Content-Type":"text/plain"});
    res.end("OK");
    return;
  }

  // ===== MOTOR JACKET ENDPOINT =====
  if(pathname==="/motor"){

    if(query.global){
      currentState.motorsEnabled = query.global === "on";
    }

    const { motor, speed, dir } = query;

    if(motor === "A"){
      if(speed !== undefined)
        currentState.motorA.speed = Number(speed);
      if(dir)
        currentState.motorA.dir = dir;
    }

    if(motor === "B"){
      if(speed !== undefined)
        currentState.motorB.speed = Number(speed);
      if(dir)
        currentState.motorB.dir = dir;
    }

    broadcastState();

    cors(res);
    res.writeHead(200,{"Content-Type":"text/plain"});
    res.end("OK");
    return;
  }

  // ===== LIGHT JACKET FIRMWARE (OTA) =====
  // The jacket asks for this on boot and after /update. It sends the MD5 of
  // the firmware it's running, so it only downloads when light.bin changed.
  if(pathname==="/firmware/light.bin"){
    const file=path.join(__dirname,"firmware","light.bin");
    if(!fs.existsSync(file)){
      res.writeHead(404,{"Content-Type":"text/plain"});
      res.end("No firmware");
      return;
    }

    const bin=fs.readFileSync(file);
    const md5=crypto.createHash("md5").update(bin).digest("hex");

    if(req.headers["x-esp8266-sketch-md5"]===md5){
      console.log("Light jacket firmware: up to date");
      res.writeHead(304);
      res.end();
      return;
    }

    console.log("Light jacket firmware: sending update");
    res.writeHead(200,{
      "Content-Type":"application/octet-stream",
      "Content-Length":bin.length,
      "x-MD5":md5
    });
    res.end(bin);
    return;
  }

  // ===== TELL THE LIGHT JACKET TO CHECK FOR NEW FIRMWARE =====
  if(pathname==="/update"){
    broadcastState({update:"light"});

    cors(res);
    res.writeHead(200,{"Content-Type":"text/plain"});
    res.end("OK");
    return;
  }

  if(pathname==="/state"){
    cors(res);
    res.writeHead(200,{"Content-Type":"application/json"});
    res.end(JSON.stringify(currentState));
    return;
  }

  if(pathname==="/"){
    res.writeHead(200,{"Content-Type":"text/plain"});
    res.end("Ethan's Jacket Server Running\n");
    return;
  }

  cors(res);
  res.writeHead(404,{"Content-Type":"text/plain"});
  res.end("Not found");
});

const wss=new WebSocket.Server({
  server,
  path:"/ws"
});

const espClients=new Set();

// extra fields ride along with the full state so the motor jacket,
// which reads every message as state, just re-applies what it has
function broadcastState(extra={}){
  const payload=JSON.stringify({...currentState,...extra});
  for(const ws of espClients){
    if(ws.readyState===WebSocket.OPEN){
      ws.send(payload);
    }
  }
}

wss.on("connection",ws=>{
  espClients.add(ws);
  ws.send(JSON.stringify(currentState));
  ws.on("close",()=>espClients.delete(ws));
});

server.listen(PORT,()=>{
  console.log("Server running on",PORT);
});