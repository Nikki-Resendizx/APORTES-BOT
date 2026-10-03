require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const { BOT_TOKEN, STORE_CHAT_ID, ADMIN_IDS, TIMEZONE } = require("./config");
const db = require("./storage");
const { fullName, vars, topicName, registration } = require("./utils");

if (!BOT_TOKEN) throw new Error("Falta BOT_TOKEN");
if (!STORE_CHAT_ID) throw new Error("Falta STORE_CHAT_ID");

const bot = new Telegraf(BOT_TOKEN);
const isAdmin = (id) => ADMIN_IDS.includes(Number(id));

async function ensure(ctx) {
  if (!ctx.from || ctx.chat.type !== "private" || db.isBanned(ctx.from.id)) return null;

  let user = db.getUser(ctx.from.id);
  if (user?.threadId) return user;

  const topic = await ctx.telegram.createForumTopic(STORE_CHAT_ID, topicName(ctx.from));
  user = {
    userId: ctx.from.id,
    threadId: topic.message_thread_id,
    createdAt: new Date().toISOString()
  };

  db.setUser(ctx.from.id, user);
  const info = registration(ctx.from);

  try {
    const photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id, { limit: 1 });
    if (photos.total_count && photos.photos[0]?.[0]) {
      await ctx.telegram.sendPhoto(STORE_CHAT_ID, photos.photos[0][0].file_id, {
        caption: info,
        message_thread_id: user.threadId
      });
    } else {
      await ctx.telegram.sendMessage(STORE_CHAT_ID, info, {
        message_thread_id: user.threadId
      });
    }
  } catch (error) {
    console.error("registration notice:", error);
    await ctx.telegram.sendMessage(STORE_CHAT_ID, info, {
      message_thread_id: user.threadId
    }).catch(() => {});
  }

  return user;
}

async function sendWelcome(ctx) {
  const user = await ensure(ctx);
  if (!user) return ctx.reply("🚫 No tienes acceso a este bot.");

  const text = vars(
    db.getWelcome() ||
      "👋 Bienvenido.\\n\\nEnvía tu mensaje y será enviado al equipo.\\n\\n#nombre • #username • #userid",
    ctx.from
  );

  const source = db.getWelcomeSource();
  if (source) {
    try {
      await ctx.telegram.copyMessage(ctx.chat.id, source.chatId, source.messageId);
      return;
    } catch (error) {
      console.error("welcome media:", error);
    }
  }

  return ctx.reply(
    text,
    Markup.inlineKeyboard([[Markup.button.callback("ℹ️ Información", "INFO")]])
  );
}

bot.start(sendWelcome);
bot.help((ctx) => ctx.reply("ℹ️ Envía cualquier mensaje para contactar al equipo."));

bot.action("INFO", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("👤 " + fullName(ctx.from) + "\\n🆔 " + ctx.from.id);
});

bot.command("info", async (ctx) => {
  const user = db.getUser(ctx.from.id);
  await ctx.reply(
    "👤 " + fullName(ctx.from) +
    "\\n🆔 " + ctx.from.id +
    "\\n🧵 Tema: " + (user?.threadId || "no creado")
  );
});

bot.command("status", (ctx) => ctx.reply("🤖 APORTES-BOT activo.\\n🕐 " + TIMEZONE));
bot.command("cancel", (ctx) => ctx.reply("❌ Operación cancelada."));

bot.command("admin", (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Solo administradores.");
  return ctx.reply(
    "⚙️ ADMIN\\n\\n" +
    "/setwelcome TEXTO\\n" +
    "/setwelcome_media\\n" +
    "/ban ID\\n" +
    "/unban ID\\n" +
    "/status"
  );
});

bot.command("setwelcome", (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Solo administradores.");

  const raw = ctx.message?.text || "";
  const text = raw.replace(/^\/setwelcome\s*/i, "").trim();

  if (text) {
    db.setWelcome(text);
    return ctx.reply(
      "✅ Bienvenida de texto guardada. Variables: #mencion #nombre #username #userid"
    );
  }

  return ctx.reply(
    "Uso: /setwelcome TEXTO\\n\\n" +
    "Para una bienvenida multimedia, responde al mensaje en el grupo de foro y usa /setwelcome_media."
  );
});

bot.command("setwelcome_media", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Solo administradores.");
  if (Number(ctx.chat.id) !== STORE_CHAT_ID) {
    return ctx.reply("Usa este comando en el grupo de foro.");
  }

  const reply = ctx.message?.reply_to_message;
  if (!reply) {
    return ctx.reply(
      "Responde al mensaje multimedia que quieres usar como bienvenida y después usa /setwelcome_media."
    );
  }

  db.setWelcomeSource({ chatId: ctx.chat.id, messageId: reply.message_id });
  return ctx.reply("✅ Bienvenida multimedia guardada.");
});

bot.command("ban", (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Solo administradores.");
  const id = Number((ctx.message?.text || "").split(/\s+/)[1]);
  if (!id) return ctx.reply("Uso: /ban ID");
  db.ban(id);
  return ctx.reply("🚫 Usuario bloqueado.");
});

bot.command("unban", (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Solo administradores.");
  const id = Number((ctx.message?.text || "").split(/\s+/)[1]);
  if (!id) return ctx.reply("Uso: /unban ID");
  db.unban(id);
  return ctx.reply("✅ Usuario desbloqueado.");
});

bot.on("message", async (ctx) => {
  if (ctx.chat.type === "private") {
    if (ctx.message.text?.startsWith("/")) return;

    const user = await ensure(ctx);
    if (!user) return;

    try {
      await ctx.telegram.copyMessage(
        STORE_CHAT_ID,
        ctx.chat.id,
        ctx.message.message_id,
        { message_thread_id: user.threadId }
      );
    } catch (error) {
      console.error("copy user:", error);
    }
    return;
  }

  if (
    Number(ctx.chat.id) !== STORE_CHAT_ID ||
    !ctx.message.message_thread_id ||
    !isAdmin(ctx.from.id)
  ) return;

  if (ctx.message.text?.startsWith("/")) return;

  const user = db.findByThread(ctx.message.message_thread_id);
  if (!user) return;

  try {
    await ctx.telegram.copyMessage(
      user.userId,
      ctx.chat.id,
      ctx.message.message_id
    );
  } catch (error) {
    console.error("copy admin:", error);
  }
});

bot.catch((error) => console.error("Telegraf:", error));
bot.launch({ dropPendingUpdates: false }).then(() => console.log("🤖 APORTES-BOT iniciado."));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
