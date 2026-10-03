require("dotenv").config();
const {Telegraf,Markup}=require("telegraf");
const {BOT_TOKEN,STORE_CHAT_ID,ADMIN_IDS}=require("./config");
const db=require("./storage");
const {fullName,vars,topicName,registration}=require("./utils");
if(!BOT_TOKEN) throw new Error("Falta BOT_TOKEN");
if(!STORE_CHAT_ID) throw new Error("Falta STORE_CHAT_ID");
const bot=new Telegraf(BOT_TOKEN);
const admin=id=>ADMIN_IDS.includes(Number(id));
async function ensure(ctx){
  if(!ctx.from || ctx.chat.type!=="private" || db.isBanned(ctx.from.id)) return null;
  let u=db.getUser(ctx.from.id);
  if(u?.threadId) return u;
  const topic=await ctx.telegram.createForumTopic(STORE_CHAT_ID,topicName(ctx.from));
  u={userId:ctx.from.id,threadId:topic.message_thread_id,createdAt:new Date().toISOString()};
  db.setUser(ctx.from.id,u);
  const info=registration(ctx.from);
  try{
    const photos=await ctx.telegram.getUserProfilePhotos(ctx.from.id,{limit:1});
    if(photos.total_count && photos.photos[0]?.[0]){
      await ctx.telegram.sendPhoto(STORE_CHAT_ID,photos.photos[0][0].file_id,{caption:info,message_thread_id:u.threadId});
    } else {
      await ctx.telegram.sendMessage(STORE_CHAT_ID,info,{message_thread_id:u.threadId});
    }
  }catch(e){
    await ctx.telegram.sendMessage(STORE_CHAT_ID,info,{message_thread_id:u.threadId}).catch(()=>{});
  }
  return u;
}
async function welcome(ctx){
  const u=await ensure(ctx); if(!u) return ctx.reply("🚫 No tienes acceso a este bot.");
  const text=vars(db.getWelcome() || "👋 Bienvenido.\n\nEnvía tu mensaje y será enviado al equipo.\n\n#nombre • #username • #userid",ctx.from);
  await ctx.reply(text,Markup.inlineKeyboard([[Markup.button.callback("ℹ️ Información","INFO")]]));
}
bot.start(welcome);
bot.help(ctx=>ctx.reply("ℹ️ Envía cualquier mensaje para contactar al equipo."));
bot.action("INFO",async ctx=>{await ctx.answerCbQuery(); await ctx.reply(`👤 ${fullName(ctx.from)}\n🆔 ${ctx.from.id}`);});
bot.command("info",async ctx=>ctx.reply(`👤 ${fullName(ctx.from)}\n🆔 ${ctx.from.id}\n🧵 Tema: ${db.getUser(ctx.from.id)?.threadId || "no creado"}`));
bot.command("status",ctx=>ctx.reply("🤖 APORTES-BOT activo.\n🕐 America/Mexico_City"));
bot.command("cancel",ctx=>ctx.reply("❌ Operación cancelada."));
bot.command("admin",ctx=>admin(ctx.from.id)?ctx.reply("⚙️ ADMIN\n\n/setwelcome TEXTO\n/ban ID\n/unban ID\n/status"):ctx.reply("⛔ Solo administradores."));
bot.command("setwelcome",ctx=>{
  if(!admin(ctx.from.id))return ctx.reply("⛔ Solo administradores.");
  const t=(ctx.message.text||"").replace(/^\\/setwelcome\\s*/i,"").trim();
  if(t){db.setWelcome(t);return ctx.reply("✅ Bienvenida de texto guardada. Variables: #mencion #nombre #username #userid");}
  return ctx.reply("Uso: /setwelcome TEXTO\\n\\nPara una bienvenida multimedia, responde a un mensaje con /setwelcome en el grupo de foro.");
});
\n// Configura una bienvenida multimedia respondiendo a cualquier mensaje del grupo de foro.\nbot.command("setwelcome_media",async ctx=>{\n  if(!admin(ctx.from.id))return ctx.reply("⛔ Solo administradores.");\n  if(ctx.chat.id!==STORE_CHAT_ID)return ctx.reply("Usa este comando en el grupo de foro.");\n  const reply=ctx.message.reply_to_message;\n  if(!reply)return ctx.reply("Responde al mensaje multimedia y usa /setwelcome_media.");\n  db.setWelcomeSource({chatId:ctx.chat.id,messageId:reply.message_id});\n  await ctx.reply("✅ Bienvenida multimedia guardada.");\n});\nbot.command("ban",ctx=>{if(!admin(ctx.from.id))return ctx.reply("⛔ Solo administradores.");const id=Number((ctx.message.text||"").split(/\\s+/)[1]);if(!id)return ctx.reply("Uso: /ban ID");db.ban(id);ctx.reply("🚫 Usuario bloqueado.");});
bot.command("unban",ctx=>{if(!admin(ctx.from.id))return ctx.reply("⛔ Solo administradores.");const id=Number((ctx.message.text||"").split(/\\s+/)[1]);if(!id)return ctx.reply("Uso: /unban ID");db.unban(id);ctx.reply("✅ Usuario desbloqueado.");});
bot.on("message",async ctx=>{
  if(ctx.chat.type==="private"){
    if(ctx.message.text?.startsWith("/")) return;
    const u=await ensure(ctx); if(!u)return;
    try{await ctx.telegram.copyMessage(STORE_CHAT_ID,ctx.chat.id,ctx.message.message_id,{message_thread_id:u.threadId});}
    catch(e){console.error("copy user",e);}
    return;
  }
  if(Number(ctx.chat.id)!==STORE_CHAT_ID || !ctx.message.message_thread_id || !admin(ctx.from.id)) return;
  const u=db.findByThread(ctx.message.message_thread_id); if(!u)return;
  try{await ctx.telegram.copyMessage(u.userId,ctx.chat.id,ctx.message.message_id);}
  catch(e){console.error("copy admin",e);}
});
bot.catch(e=>console.error("Telegraf:",e));
bot.launch({dropPendingUpdates:false}).then(()=>console.log("🤖 APORTES-BOT iniciado."));
process.once("SIGINT",()=>bot.stop("SIGINT")); process.once("SIGTERM",()=>bot.stop("SIGTERM"));
