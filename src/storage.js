const fs = require("fs");
const path = require("path");
const dir = path.join(process.cwd(), "data");
const file = path.join(dir, "state.json");
let state;
try { state = JSON.parse(fs.readFileSync(file, "utf8")); } catch { state = {}; }
state.users ||= {};
state.welcome ||= null;
state.welcomeSource ||= null;
state.welcomeButtons ||= [];
state.quickResponses ||= {};
state.commandTexts ||= {};
state.registrationTemplate ||= null;
state.registrationButtons ||= null;
state.bans ||= [];
state.topicStats ||= {};
function save(){ fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(file,JSON.stringify(state,null,2)); }
function getUser(id){ return state.users[String(id)] || null; }
function setUser(id,value){ state.users[String(id)] = value; save(); }
function findByThread(thread){ return Object.values(state.users).find(user=>user.threadId===Number(thread)); }
function getWelcome(){ return state.welcome; }
function setWelcome(value){ state.welcome=value; save(); }
function getWelcomeSource(){ return state.welcomeSource || null; }
function setWelcomeSource(value){ state.welcomeSource=value; save(); }
function clearWelcome(){ state.welcome=null; state.welcomeSource=null; state.welcomeButtons=[]; save(); }
function getWelcomeButtons(){ return state.welcomeButtons || []; }
function setWelcomeButtons(value){ state.welcomeButtons=value; save(); }
function getRegistrationTemplate(){ return state.registrationTemplate || null; }
function setRegistrationTemplate(value){ state.registrationTemplate=value; save(); }
function getRegistrationButtons(){ return state.registrationButtons || null; }
function setRegistrationButtons(value){ state.registrationButtons=value; save(); }
function getQuickResponses(){ return state.quickResponses || {}; }
function getCommandText(command){ return state.commandTexts[String(command).toLowerCase()] || null; }
function setCommandText(command,value){ state.commandTexts[String(command).toLowerCase()]=value; save(); }
function deleteCommandText(command){ delete state.commandTexts[String(command).toLowerCase()]; save(); }
function getCommandTexts(){ return state.commandTexts || {}; }
function getQuickResponse(command){ return state.quickResponses[String(command).toLowerCase()] || null; }
function setQuickResponse(command,value){ state.quickResponses[String(command).toLowerCase()]={...(state.quickResponses[String(command).toLowerCase()]||{}),...value}; save(); }
function deleteQuickResponse(command){ delete state.quickResponses[String(command).toLowerCase()]; save(); }
function isBanned(id){ return state.bans.includes(Number(id)); }
function ban(id){ if(!state.bans.includes(Number(id))) state.bans.push(Number(id)); save(); }
function unban(id){ state.bans=state.bans.filter(value=>value!==Number(id)); save(); }
function markBlocked(id,value=true){ const user=getUser(id); if(!user)return; user.blocked=value; if(value)user.blockedAt=new Date().toISOString(); else delete user.blockedAt; setUser(id,user); }
// La actividad del tema pertenece al administrador/equipo y NO determina
// si el usuario inició una conversación. La señal válida se registra desde
// el chat privado, después de entregar un mensaje real del usuario al tema.
function markActivityByThread(thread){ return findByThread(thread); }
function getStats(){ const users=Object.values(state.users); return {total:users.length,blocked:users.filter(u=>u.blocked).length,banned:state.bans.length,activeTopics:users.filter(u=>u.threadId).length}; }
function getUsers(){ return Object.values(state.users); }
function deleteUser(id){ delete state.users[String(id)]; save(); }
function resetUsers(){ state.users={}; state.topicStats={}; save(); }
module.exports={getUser,setUser,findByThread,getWelcome,setWelcome,getWelcomeSource,setWelcomeSource,clearWelcome,getWelcomeButtons,setWelcomeButtons,getRegistrationTemplate,setRegistrationTemplate,getRegistrationButtons,setRegistrationButtons,getQuickResponses,getQuickResponse,setQuickResponse,deleteQuickResponse,getCommandText,setCommandText,deleteCommandText,getCommandTexts,isBanned,ban,unban,markBlocked,markActivityByThread,getStats,getUsers,deleteUser,resetUsers};
