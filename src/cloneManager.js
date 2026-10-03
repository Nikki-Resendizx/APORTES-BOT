const { Telegraf, Markup } = require("telegraf");
const db = require("./storage");

const runtimes = new Map();

function premium(ownerId){ return db.getPremium(ownerId).active; }
function cloneCount(ownerId){ return db.getUserClones(ownerId).length; }

function topicKeyboard(userId){
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🚷 Banear", "CBAN:"+userId),
      Markup.button.callback("🚹 Desbanear", "CUNBAN:"+userId)
    ],
    [Markup.button.callback("ℹ️ Información", "CINFO:"+userId)]
  ]);
}

async function startClone(record){
  if(!record?.token) return false;
  if(runtimes.has(record.id)) return true;
  const b=new Telegraf(record.token);
  b.catch(e=>console.error("clone "+record.id+":",e));
  b.start(async ctx=>{
    if(ctx.chat.type!=="private") return;
    if(record.bannedUsers?.includes(ctx.from.id)) return ctx.reply("🚫 Tu acceso está bloqueado.");
    let u=record.users?.[String(ctx.from.id)];
    if(!u){
      if(!record.storeChatId) return ctx.reply("⚙️ Este bot todavía no tiene un grupo de temas configurado. El propietario debe usar /vincular en el grupo.");
      const topic=await b.telegram.createForumTopic(record.storeChatId,(ctx.from.first_name||"Usuario")+" • "+ctx.from.id);
      u={userId:ctx.from.id,threadId:topic.message_thread_id,name:[ctx.from.first_name,ctx.from.last_name].filter(Boolean).join(" "),username:ctx.from.username||"",createdAt:new Date().toISOString()};
      record.users[String(ctx.from.id)]=u;
      db.setClone(record.id,record);
      await b.telegram.sendMessage(record.storeChatId,"👤 NUEVO USUARIO\n\n📝 Nombre: "+u.name+"\n🔗 Username: "+(u.username?"@"+u.username:"Sin username")+"\n🆔 ID: "+u.userId+"\n📅 Registro: "+new Date().toLocaleString("es-MX"),{message_thread_id:u.threadId,...topicKeyboard(u.userId)}).catch(()=>{});
    }
    return ctx.reply("👋 Bienvenido.\n\nEnvía cualquier mensaje y será enviado al equipo.");
  });
  b.command("vincular",async ctx=>{
    if(!ctx.from || Number(ctx.from.id)!==Number(record.ownerId)) return;
    if(ctx.chat.type==="private") return ctx.reply("📌 Añade este bot como administrador al grupo de temas y escribe /vincular dentro del grupo.");
    try{
      const chat=await b.telegram.getChat(ctx.chat.id);
      if(!chat.is_forum) return ctx.reply("❌ Este grupo no tiene Topics/Temas activados.");
      record.storeChatId=ctx.chat.id;
      record.status="active";
      record.updatedAt=new Date().toISOString();
      db.setClone(record.id,record);
      return ctx.reply("✅ GRUPO VINCULADO\n\n🧵 Este grupo será el centro de atención de tu bot.\n🤖 El bot ya puede crear un tema por usuario.");
    }catch(e){ return ctx.reply("❌ No pude verificar el grupo. Asegúrate de que el bot sea administrador y tenga permiso para gestionar temas."); }
  });
  b.command("config",ctx=>{
    if(Number(ctx.from?.id)!==Number(record.ownerId)) return;
    return ctx.reply("⚙️ CONFIGURACIÓN\n\n🤖 Bot: "+(record.name||record.id)+"\n🧵 Grupo: "+(record.storeChatId||"No vinculado")+"\n📌 Estado: "+(record.status||"stopped")+"\n💎 Plan: "+(premium(record.ownerId)?"PREMIUM":"FREE"));
  });
  b.on("message",async ctx=>{
    if(ctx.chat.type==="private"){
      if(ctx.from.id===record.ownerId && ctx.message.text?.startsWith("/")) return;
      if(!record.storeChatId) return;
      let u=record.users?.[String(ctx.from.id)];
      if(!u){
        const topic=await b.telegram.createForumTopic(record.storeChatId,(ctx.from.first_name||"Usuario")+" • "+ctx.from.id);
        u={userId:ctx.from.id,threadId:topic.message_thread_id,name:[ctx.from.first_name,ctx.from.last_name].filter(Boolean).join(" "),username:ctx.from.username||"",createdAt:new Date().toISOString()};
        record.users[String(ctx.from.id)]=u; db.setClone(record.id,record);
        await b.telegram.sendMessage(record.storeChatId,"👤 NUEVO USUARIO\n\n📝 Nombre: "+u.name+"\n🔗 Username: "+(u.username?"@"+u.username:"Sin username")+"\n🆔 ID: "+u.userId,{message_thread_id:u.threadId,...topicKeyboard(u.userId)}).catch(()=>{});
      }
      try{ await b.telegram.forwardMessage(record.storeChatId,ctx.chat.id,ctx.message.message_id,{message_thread_id:u.threadId}); }
      catch(e){ console.error("clone user->topic",e); }
      return;
    }
    if(Number(ctx.chat.id)!==Number(record.storeChatId) || !ctx.message.message_thread_id) return;
    const u=Object.values(record.users||{}).find(x=>Number(x.threadId)===Number(ctx.message.message_thread_id));
    if(!u || ctx.message.text?.startsWith("/")) return;
    try{ await b.telegram.forwardMessage(u.userId,ctx.chat.id,ctx.message.message_id); }catch(e){ console.error("clone topic->user",e); }
  });
  b.action(/^CBAN:(\d+)$/,async ctx=>{
    if(Number(ctx.from.id)!==Number(record.ownerId) && ctx.chat.type==="private") return ctx.answerCbQuery("Solo el propietario");
    const id=Number(ctx.match[1]); record.bannedUsers ||= []; if(!record.bannedUsers.includes(id)) record.bannedUsers.push(id); db.setClone(record.id,record);
    await ctx.answerCbQuery("Usuario baneado"); return ctx.editMessageReplyMarkup(topicKeyboard(id).reply_markup).catch(()=>{});
  });
  b.action(/^CUNBAN:(\d+)$/,async ctx=>{
    const id=Number(ctx.match[1]); record.bannedUsers=(record.bannedUsers||[]).filter(x=>Number(x)!==id); db.setClone(record.id,record); await ctx.answerCbQuery("Usuario desbaneado");
  });
  b.action(/^CINFO:(\d+)$/,async ctx=>{
    const id=Number(ctx.match[1]); const u=record.users?.[String(id)]; await ctx.answerCbQuery();
    return ctx.reply("ℹ️ INFORMACIÓN\n\n👤 "+(u?.name||"Sin nombre")+"\n🆔 "+id+"\n🔗 "+(u?.username?"@"+u.username:"Sin username")+"\n🧵 Tema: "+(u?.threadId||"N/D"));
  });
  await b.launch({dropPendingUpdates:false});
  runtimes.set(record.id,b);
  record.status=record.storeChatId?"active":"waiting_group";
  record.updatedAt=new Date().toISOString();
  db.setClone(record.id,record);
  return true;
}

async function validateToken(token){
  const test=new Telegraf(token);
  try{ const me=await test.telegram.getMe(); return me; }catch(e){ return null; }
}

async function createClone(ownerId,token){
  const me=await validateToken(token);
  if(!me) return {error:"TOKEN_INVALID"};
  if(Object.values(db.getClones()).some(c=>c.token===token)) return {error:"TOKEN_EXISTS"};
  const id=String(me.id);
  const record={id,ownerId:Number(ownerId),token,name:me.first_name||me.username||id,username:me.username||"",botId:me.id,status:"starting",storeChatId:null,users:{},bannedUsers:[],createdAt:new Date().toISOString()};
  db.setClone(id,record);
  try{ await startClone(record); }catch(e){ db.deleteClone(id); throw e; }
  return {record,me};
}

async function stopClone(id){
  const b=runtimes.get(String(id)); if(b){ b.stop(); runtimes.delete(String(id)); }
  const r=db.getClone(id); if(r){r.status="stopped";db.setClone(id,r);}
}
async function startAll(){ for(const r of Object.values(db.getClones())){ try{await startClone(r);}catch(e){console.error("start clone",r.id,e.message);} } }

module.exports={startAll,createClone,stopClone,validateToken,premium,cloneCount,runtimes};
