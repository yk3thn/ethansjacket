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
  b: 255,
  c1r: 0, c1g: 0, c1b: 255,
  c2r: 255, c2g: 0, c2b: 255
};

function cors(res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
}

const server=http.createServer((req,res)=>{
  const parsed=url.parse(req.url,true);
  const {pathname,query}=parsed;

  if(pathname==="/set"){
    console.log("SET:",query);

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

    broadcastState();

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
    res.end("Ethan's Jacket Server is running.\n");
    return;
  }

  cors(res);
  res.writeHead(404,{"Content-Type": "text/plain"});
  res.end("Not found");
});

const wss=new WebSocket.Server({
  server,
  path:"/ws"
});

const espClients=new Set();

function broadcastState(){
  const payload=JSON.stringify(currentState);
  console.log("Broadcast:",payload);
  for(const ws of espClients){
    if(ws.readyState===WebSocket.OPEN){
      ws.send(payload);
    }
  }
}

wss.on("connection",ws=>{
  console.log("ESP Connected");
  espClients.add(ws);

  ws.send(JSON.stringify(currentState));

  ws.on("close",()=>{
    espClients.delete(ws);
  });
});

server.listen(PORT,()=>{
  console.log("Server running on",PORT);
});
