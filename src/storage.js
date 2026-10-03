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
state.registrationTemplate ||= null;
state.registrationButtons ||= null;
state.bans ||= [];
state.topicStats ||= {};
state.clones ||= {};
state.premium ||= {};
state.promoCodes ||= {};

function getClones(){ return state.clones || {}; }
function getClone(id){ return state.clones[String(id)] || null; }
function setClone(id,value){ state.clones[String(id)] = value; save(); }
function deleteClone(id){ delete state.clones[String(id)]; save(); }
function getUserClones(ownerId){ return Object.values(state.clones).filter(c=>Number(c.ownerId)===Number(ownerId)); }

function getPremium(userId){
  const p = state.premium[String(userId)];
  if(!p) return {active:false,expiresAt:null,plan:"free"};
  const active = p.expiresAt && new Date(p.expiresAt).getTime() > Date.now();
  return { ...p, active, plan: active ? "premium" : "free" };
}
function grantPremium(userId, days=30, source="admin"){
  const id=String(userId), current=getPremium(userId);
  const base=current.active ? new Date(current.expiresAt).getTime() : Date.now();
  const expiresAt=new Date(base + Number(days)*86400000).toISOString();
  state.premium[id]={userId:Number(userId),expiresAt,source,updatedAt:new Date().toISOString()};
  save(); return getPremium(userId);
}
function revokePremium(userId){ delete state.premium[String(userId)]; save(); }
function setPromoCode(code, days=30, uses=1){
  state.promoCodes[String(code).trim().toUpperCase()]={days:Number(days),uses:Number(uses),createdAt:new Date().toISOString()}; save();
}
function redeemPromoCode(code,userId){
  const key=String(code).trim().toUpperCase(), promo=state.promoCodes[key];
  if(!promo || promo.uses<=0) return null;
  promo.uses--; const result=grantPremium(userId,promo.days,"promo:"+key);
  if(promo.uses<=0) delete state.promoCodes[key]; save(); return result;
}
function getPremiumUsers(){ return Object.values(state.premium||{}); }

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
function getQuickResponse(command){ return state.quickResponses[String(command).toLowerCase()] || null; }
function setQuickResponse(command,value){ state.quickResponses[String(command).toLowerCase()]={...(state.quickResponses[String(command).toLowerCase()]||{}),...value}; save(); }
function deleteQuickResponse(command){ delete state.quickResponses[String(command).toLowerCase()]; save(); }
function isBanned(id){ return state.bans.includes(Number(id)); }
function ban(id){ if(!state.bans.includes(Number(id))) state.bans.push(Number(id)); save(); }
function unban(id){ state.bans=state.bans.filter(value=>value!==Number(id)); save(); }
function markBlocked(id,value=true){ const user=getUser(id); if(!user)return; user.blocked=value; if(value)user.blockedAt=new Date().toISOString(); else delete user.blockedAt; setUser(id,user); }
function markActivityByThread(thread){ const user=findByThread(thread); if(!user)return null; user.hasConversation=true; user.lastActivityAt=new Date().toISOString(); setUser(user.userId,user); return user; }
function getStats(){ const users=Object.values(state.users); return {total:users.length,blocked:users.filter(u=>u.blocked).length,banned:state.bans.length,activeTopics:users.filter(u=>u.threadId).length}; }
function getUsers(){ return Object.values(state.users); }
function deleteUser(id){ delete state.users[String(id)]; save(); }
function resetUsers(){ state.users={}; state.topicStats={}; save(); }
module.exports={getClones,getClone,setClone,deleteClone,getUserClones,getPremium,grantPremium,revokePremium,setPromoCode,redeemPromoCode,getPremiumUsers,getUser,setUser,findByThread,getWelcome,setWelcome,getWelcomeSource,setWelcomeSource,clearWelcome,getWelcomeButtons,setWelcomeButtons,getRegistrationTemplate,setRegistrationTemplate,getRegistrationButtons,setRegistrationButtons,getQuickResponses,getQuickResponse,setQuickResponse,deleteQuickResponse,isBanned,ban,unban,markBlocked,markActivityByThread,getStats,getUsers,deleteUser,resetUsers};
