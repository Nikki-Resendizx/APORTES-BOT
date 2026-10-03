const fs = require("fs");
const path = require("path");
const dir = path.join(process.cwd(), "data");
const file = path.join(dir, "state.json");
let state;
try { state = JSON.parse(fs.readFileSync(file, "utf8")); } catch { state = { users: {}, welcome: null, bans: [] }; }
function save(){ fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(file,JSON.stringify(state,null,2)); }
function getUser(id){ return state.users[String(id)] || null; }
function setUser(id,v){ state.users[String(id)]=v; save(); }
function findByThread(thread){ return Object.values(state.users).find(x=>x.threadId===Number(thread)); }
function getWelcome(){ return state.welcome; }
function setWelcome(v){ state.welcome=v; save(); }
function isBanned(id){ return state.bans.includes(Number(id)); }
function ban(id){ if(!state.bans.includes(Number(id))) state.bans.push(Number(id)); save(); }
function unban(id){ state.bans=state.bans.filter(x=>x!==Number(id)); save(); }
module.exports={getUser,setUser,findByThread,getWelcome,setWelcome,isBanned,ban,unban};
