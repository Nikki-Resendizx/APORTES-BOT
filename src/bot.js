require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const { BOT_TOKEN, STORE_CHAT_ID, ADMIN_IDS, TIMEZONE } = require("./config");
const db = require("./storage");
const { fullName, vars, topicName, registration } = require("./utils");

if (!BOT_TOKEN) throw new Error("Falta BOT_TOKEN");
if (!STORE_CHAT_ID) throw new Error("Falta STORE_CHAT_ID");

const bot = new Telegraf(BOT_TOKEN);
const isAdmin = (id) => ADMIN_IDS.includes(Number(id));
const pending = new Map();

function welcomeKeyboard() {
  const rows = db.getWelcomeButtons().map((b) => [
    b.url ? Markup.button.url(b.text, b.url) : Markup.button.callback(b.text, b.callback || "INFO")
  ]);
  return rows.length ? Markup.inlineKeyboard(rows) : Markup.inlineKeyboard([
    [Markup.button.callback("ℹ️ Información", "INFO")]
  ]);
}

function welcomeMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📝 Texto", "W_TXT"), Markup.button.callback("🖼️ Multimedia", "W_MEDIA")],
    [Markup.button.callback("🔘 Botones", "W_BUTTONS"), Markup.button.callback("👁️ Vista previa", "W_PREVIEW")],
    [Markup.button.callback("🧩 Variables", "W_VARS")],
    [Markup.button.callback("🗑️ Eliminar bienvenida", "W_DELETE")],
    [Markup.button.callback("⚡ Respuestas rápidas", "QR_MENU")]
  ]);
}

function quickMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("➕ Crear comando", "QR_ADD")],
    [Markup.button.callback("📋 Mis comandos", "QR_LIST")],
    [Markup.button.callback("🗑️ Eliminar comando", "QR_DELETE")],
    [Markup.button.callback("🔙 Volver", "W_MENU")]
  ]);
}

async function ensure(ctx) {
  if (!ctx.from || ctx.chat.type !== "private" || db.isBanned(ctx.from.id)) return null;
  let user = db.getUser(ctx.from.id);
  if (user?.threadId) return user;

  const topic = await ctx.telegram.createForumTopic(STORE_CHAT_ID, topicName(ctx.from));
  user = { userId: ctx.from.id, threadId: topic.message_thread_id, createdAt: new Date().toISOString() };
  db.setUser(ctx.from.id, user);
  const info = registration(ctx.from);

  try {
    const photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id, { limit: 1 });
    if (photos.total_count && photos.photos[0]?.[0]) {
      await ctx.telegram.sendPhoto(STORE_CHAT_ID, photos.photos[0][0].file_id, { caption: info, message_thread_id: user.threadId });
    } else {
      await ctx.telegram.sendMessage(STORE_CHAT_ID, info, { message_thread_id: user.threadId });
    }
  } catch (error) {
    console.error("registration notice:", error);
    await ctx.telegram.sendMessage(STORE_CHAT_ID, info, { message_thread_id: user.threadId }).catch(() => {});
  }
  return user;
}

async function sendWelcome(ctx) {
  const user = await ensure(ctx);
  if (!user) return ctx.reply("🚫 No tienes acceso a este bot.");

  const text = vars(db.getWelcome() || "👋 Bienvenido.\n\nEnvía tu mensaje y será enviado al equipo.\n\n#nombre • #username • #userid", ctx.from);
  const source = db.getWelcomeSource();

  if (source) {
    try {
      await ctx.telegram.copyMessage(ctx.chat.id, source.chatId, source.messageId, { reply_markup: welcomeKeyboard().reply_markup });
      return;
    } catch (error) {
      console.error("welcome media:", error);
    }
  }

  return ctx.reply(text, welcomeKeyboard());
}

bot.start(sendWelcome);
bot.help((ctx) => ctx.reply("ℹ️ Envía cualquier mensaje para contactar al equipo."));
bot.action("INFO", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("👤 " + fullName(ctx.from) + "\n🆔 " + ctx.from.id);
});

bot.command("info", async (ctx) => {
  const user = db.getUser(ctx.from.id);
  await ctx.reply("👤 " + fullName(ctx.from) + "\n🆔 " + ctx.from.id + "\n🧵 Tema: " + (user?.threadId || "no creado"));
});
bot.command("status", (ctx) => ctx.reply("🤖 APORTES-BOT activo.\n🕐 " + TIMEZONE));
bot.command("cancel", (ctx) => { pending.delete(ctx.from.id); return ctx.reply("❌ Operación cancelada."); });

bot.command("admin", (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Solo administradores.");
  return ctx.reply("⚙️ PANEL DE ADMINISTRACIÓN", welcomeMenu());
});

bot.command("setwelcome", (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Solo administradores.");
  return ctx.reply("👋 CONFIGURAR BIENVENIDA\n\nElige qué quieres configurar:", welcomeMenu());
});

bot.action("W_MENU", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.editMessageText("👋 CONFIGURAR BIENVENIDA\n\nElige una opción:", welcomeMenu());
});

bot.action("W_TXT", async (ctx) => {
  await ctx.answerCbQuery();
  pending.set(ctx.from.id, { type: "welcome_text" });
  return ctx.reply(
    "📝 Envía ahora el texto de bienvenida.\n\nVariables disponibles:\n#mencion\n#nombre\n#username\n#userid\n\nPuedes usar formato de Telegram.",
    Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "W_MENU")]])
  );
});

bot.action("W_MEDIA", async (ctx) => {
  await ctx.answerCbQuery();
  pending.set(ctx.from.id, { type: "welcome_media" });
  return ctx.reply("🖼️ Envía ahora la foto, video, documento, audio, sticker o multimedia que quieras usar como bienvenida.\n\nEl mensaje recibido se guardará como plantilla de bienvenida.");
});

bot.action("W_BUTTONS", async (ctx) => {
  await ctx.answerCbQuery();
  const buttons = db.getWelcomeButtons();
  const lines = buttons.length ? buttons.map((b, i) => (i + 1) + ". " + b.text + (b.url ? " → " + b.url : "")).join("\n") : "No hay botones configurados.";
  return ctx.reply(
    "🔘 BOTONES DE BIENVENIDA\n\n" + lines + "\n\nPara agregar uno usa:\nTexto | https://ejemplo.com",
    Markup.inlineKeyboard([
      [Markup.button.callback("➕ Agregar botón", "W_BTN_ADD")],
      [Markup.button.callback("🗑️ Borrar todos", "W_BTN_CLEAR")],
      [Markup.button.callback("🔙 Volver", "W_MENU")]
    ])
  );
});

bot.action("W_BTN_ADD", async (ctx) => {
  await ctx.answerCbQuery();
  pending.set(ctx.from.id, { type: "welcome_button" });
  return ctx.reply("🔘 Envía el botón con este formato:\n\nTexto del botón | https://ejemplo.com");
});

bot.action("W_BTN_CLEAR", async (ctx) => {
  await ctx.answerCbQuery();
  db.setWelcomeButtons([]);
  return ctx.reply("✅ Botones eliminados.", welcomeMenu());
});

bot.action("W_VARS", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply("🧩 VARIABLES\n\n#mencion → nombre completo\n#nombre → nombre completo\n#username → @username\n#userid → ID de Telegram");
});

bot.action("W_PREVIEW", async (ctx) => {
  await ctx.answerCbQuery();
  const source = db.getWelcomeSource();
  const text = vars(db.getWelcome() || "👋 Bienvenido.\n\nConfigura tu bienvenida desde /setwelcome.", ctx.from);
  if (source) {
    try {
      await ctx.telegram.copyMessage(ctx.chat.id, source.chatId, source.messageId, { reply_markup: welcomeKeyboard().reply_markup });
    } catch {
      await ctx.reply(text, welcomeKeyboard());
    }
  } else {
    await ctx.reply(text, welcomeKeyboard());
  }
  return ctx.reply("👆 Vista previa actual.", welcomeMenu());
});

bot.action("W_DELETE", async (ctx) => {
  await ctx.answerCbQuery();
  db.clearWelcome();
  pending.delete(ctx.from.id);
  return ctx.reply("🗑️ Bienvenida eliminada. El bot volverá a usar la bienvenida predeterminada.", welcomeMenu());
});

bot.action("QR_MENU", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.editMessageText("⚡ RESPUESTAS RÁPIDAS\n\nCrea comandos personalizados que el bot responderá automáticamente.", quickMenu());
});

bot.action("QR_ADD", async (ctx) => {
  await ctx.answerCbQuery();
  pending.set(ctx.from.id, { type: "quick_command" });
  return ctx.reply("⚡ CREAR COMANDO\n\nEscribe el nombre sin /\nEjemplo: contacto");
});

bot.action("QR_LIST", async (ctx) => {
  await ctx.answerCbQuery();
  const items = Object.entries(db.getQuickResponses());
  if (!items.length) return ctx.reply("📋 No hay comandos personalizados.", quickMenu());
  const text = items.map(([cmd, v]) => "• /" + cmd + (v.text ? " — " + v.text.slice(0, 50) : " — multimedia")).join("\n");
  return ctx.reply("📋 COMANDOS PERSONALIZADOS\n\n" + text, quickMenu());
});

bot.action("QR_DELETE", async (ctx) => {
  await ctx.answerCbQuery();
  const items = Object.keys(db.getQuickResponses());
  if (!items.length) return ctx.reply("No hay comandos para eliminar.", quickMenu());
  pending.set(ctx.from.id, { type: "quick_delete" });
  return ctx.reply(
    "🗑️ Escribe el comando que quieres eliminar.\nEjemplo: contacto",
    Markup.inlineKeyboard([[Markup.button.callback("🔙 Volver", "QR_MENU")]])
  );
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

bot.on("message", async (ctx, next) => {
  const p = pending.get(ctx.from?.id);

  if (p && isAdmin(ctx.from.id) && ctx.chat.type === "private") {
    if (p.type === "welcome_text" && ctx.message.text) {
      db.setWelcome(ctx.message.text);
      db.setWelcomeSource(null);
      pending.delete(ctx.from.id);
      return ctx.reply("✅ Texto de bienvenida guardado.", welcomeMenu());
    }

    if (p.type === "welcome_media" && !ctx.message.text?.startsWith("/")) {
      db.setWelcomeSource({ chatId: ctx.chat.id, messageId: ctx.message.message_id });
      pending.delete(ctx.from.id);
      return ctx.reply("✅ Bienvenida multimedia guardada.", welcomeMenu());
    }

    if (p.type === "welcome_button" && ctx.message.text) {
      const parts = ctx.message.text.split("|").map(x => x.trim());
      if (parts.length < 2 || !parts[0] || !/^https?:\/\//i.test(parts[1])) {
        return ctx.reply("❌ Formato incorrecto. Usa:\nTexto del botón | https://ejemplo.com");
      }
      const buttons = db.getWelcomeButtons();
      buttons.push({ text: parts[0], url: parts[1] });
      db.setWelcomeButtons(buttons);
      pending.delete(ctx.from.id);
      return ctx.reply("✅ Botón agregado.", welcomeMenu());
    }

    if (p.type === "quick_command" && ctx.message.text) {
      const command = ctx.message.text.trim().replace(/^\//, "").toLowerCase();
      if (!/^[a-z0-9_]{2,32}$/.test(command)) return ctx.reply("❌ Nombre inválido. Usa letras, números y _ (2-32 caracteres).");
      pending.set(ctx.from.id, { type: "quick_text", command });
      return ctx.reply("✅ Comando /" + command + " creado.\n\nAhora envía el texto que debe responder.");
    }

    if (p.type === "quick_text" && ctx.message.text) {
      db.setQuickResponse(p.command, { text: ctx.message.text, source: null });
      pending.delete(ctx.from.id);
      return ctx.reply("✅ Respuesta rápida /" + p.command + " guardada.", quickMenu());
    }

    if (p.type === "quick_delete" && ctx.message.text) {
      const command = ctx.message.text.trim().replace(/^\//, "").toLowerCase();
      if (!db.getQuickResponse(command)) return ctx.reply("❌ Ese comando no existe.");
      db.deleteQuickResponse(command);
      pending.delete(ctx.from.id);
      return ctx.reply("🗑️ /" + command + " eliminado.", quickMenu());
    }
  }

  if (ctx.chat.type === "private") {
    if (ctx.message.text?.startsWith("/")) {
      const command = ctx.message.text.split(/\s+/)[0].slice(1).split("@")[0].toLowerCase();
      const quick = db.getQuickResponse(command);
      if (quick) {
        if (quick.source) return ctx.telegram.copyMessage(ctx.chat.id, quick.source.chatId, quick.source.messageId);
        return ctx.reply(vars(quick.text, ctx.from));
      }
      return;
    }

    const user = await ensure(ctx);
    if (!user) return;
    try {
      await ctx.telegram.copyMessage(STORE_CHAT_ID, ctx.chat.id, ctx.message.message_id, { message_thread_id: user.threadId });
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
    await ctx.telegram.copyMessage(user.userId, ctx.chat.id, ctx.message.message_id);
  } catch (error) {
    console.error("copy admin:", error);
  }

  if (next) return next();
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

bot.catch((error) => console.error("Telegraf:", error));
bot.launch({ dropPendingUpdates: false }).then(() => console.log("🤖 APORTES-BOT iniciado."));
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
