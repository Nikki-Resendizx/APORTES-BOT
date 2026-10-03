require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const { BOT_TOKEN, STORE_CHAT_ID, ADMIN_IDS, TIMEZONE } = require("./config");
const db = require("./storage");
const {
  fullName, varsHtml, hasVars, formatMessageHtml, topicName, registration
} = require("./utils");

if (!BOT_TOKEN) throw new Error("Falta BOT_TOKEN");
if (!STORE_CHAT_ID) throw new Error("Falta STORE_CHAT_ID");

const bot = new Telegraf(BOT_TOKEN);
const isAdmin = (id) => ADMIN_IDS.includes(Number(id));
const pending = new Map();

function styleButton(text, url, callback_data, style) {
  return {
    text,
    style: style || undefined,
    ...(url ? { url } : { callback_data: callback_data || "INFO" })
  };
}

function keyboardFromButtons(buttons = []) {
  const rows = buttons.map((b) => [styleButton(b.text, b.url, b.callback, b.style)]);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

function topicModerationKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🔨 BANEAR", "TOPIC_BAN"),
      Markup.button.callback("🔓 DESBANEAR", "TOPIC_UNBAN")
    ],
    [Markup.button.callback("ℹ️ INFORMACIÓN", "TOPIC_INFO")]
  ]);
}

async function topicUser(ctx) {
  const threadId = ctx.callbackQuery?.message?.message_thread_id ?? ctx.message?.message_thread_id;
  if (Number(ctx.chat?.id) !== STORE_CHAT_ID || !threadId) return null;
  return db.findByThread(threadId);
}

function welcomeKeyboard() {
  return Markup.inlineKeyboard(
    db.getWelcomeButtons().length
      ? db.getWelcomeButtons().map((b) => [styleButton(b.text, b.url, b.callback, b.style)])
      : [[styleButton("ℹ️ Información", null, "INFO", "primary")]]
  );
}

function adminMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("👋 Bienvenida", "W_MENU")],
    [Markup.button.callback("📊 Estadísticas", "ADMIN_STATS")],
    [Markup.button.callback("🧹 Limpiar temas vacíos", "ADMIN_SCAN_EMPTY")],
    [Markup.button.callback("⚡ Respuestas rápidas", "QR_MENU")]
  ]);
}

function welcomeMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📝 Texto", "W_TXT"), Markup.button.callback("🖼️ Multimedia", "W_MEDIA")],
    [Markup.button.callback("🔘 Botones", "W_BUTTONS"), Markup.button.callback("👁️ Vista previa", "W_PREVIEW")],
    [Markup.button.callback("🧩 Variables", "W_VARS")],
    [Markup.button.callback("🗑️ Eliminar bienvenida", "W_DELETE")],
    [Markup.button.callback("⚡ Respuestas rápidas", "QR_MENU")],
    [Markup.button.callback("🔙 Panel principal", "ADMIN_MENU")]
  ]);
}

function quickMenu(command) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📝 Texto", "QR_TEXT")],
    [Markup.button.callback("🖼️ Multimedia + texto", "QR_MEDIA")],
    [Markup.button.callback("🔘 Botones Style", "QR_BUTTONS")],
    [Markup.button.callback("👁️ Vista previa", "QR_PREVIEW")],
    [Markup.button.callback("✅ Guardar", "QR_DONE")],
    [Markup.button.callback("🔙 Volver", "QR_MENU")]
  ]);
}

function quickButtonMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("➕ Agregar botón", "QR_BTN_ADD")],
    [Markup.button.callback("🗑️ Borrar botones", "QR_BTN_CLEAR")],
    [Markup.button.callback("🔙 Volver", "QR_CONFIG")]
  ]);
}

function sourceFromMessage(ctx) {
  const m = ctx.message;
  const isMedia = !!(m.photo || m.video || m.document || m.audio || m.voice || m.animation);
  const text = m.text ?? m.caption ?? "";
  const entities = m.entities ?? m.caption_entities ?? [];
  return {
    chatId: ctx.chat.id,
    messageId: m.message_id,
    text,
    entities,
    media: isMedia
  };
}

function sourceHasVars(source) {
  return !!source && hasVars(source.text);
}

function defaultWelcome() {
  return {
    text: "👋 Bienvenido.\n\nEnvía tu mensaje y será enviado al equipo.\n\n{nombre} • {username} • {userid}",
    entities: []
  };
}

async function sendStoredSource(ctx, source, user, buttons) {
  if (!source) return false;
  const reply_markup = keyboardFromButtons(buttons);

  if (!sourceHasVars(source)) {
    try {
      await ctx.telegram.copyMessage(ctx.chat.id, source.chatId, source.messageId, { reply_markup });
      return true;
    } catch (error) {
      console.error("copy stored source:", error);
    }
  }

  const html = formatMessageHtml(source.text || "", source.entities || [], user);
  if (!source.media) {
    await ctx.reply(html || " ", { parse_mode: "HTML", reply_markup });
    return true;
  }

  try {
    await ctx.telegram.copyMessage(ctx.chat.id, source.chatId, source.messageId, {
      caption: html || undefined,
      parse_mode: "HTML",
      reply_markup
    });
    return true;
  } catch (error) {
    console.error("copy stored media:", error);
    return false;
  }
}

async function fetchProfile(ctx) {
  const base = ctx.from || {};
  let chat = {};
  try { chat = await ctx.telegram.getChat(base.id); } catch (error) { console.error("get user chat:", error); }

  return {
    userId: base.id,
    id: base.id,
    first_name: base.first_name,
    last_name: base.last_name,
    username: base.username,
    is_premium: !!base.is_premium,
    language_code: base.language_code || "",
    bio: chat.bio || "",
  };
}

async function refreshRegistrationCard(ctx, user, previousPhotoFileId = "") {
  if (!user?.threadId || !user.registrationMessageId) return;
  const info = registration(user);
  const reply_markup = topicModerationKeyboard().reply_markup;

  try {
    if (user.profilePhotoFileId && user.profilePhotoFileId !== previousPhotoFileId) {
      const edited = await ctx.telegram.editMessageMedia(
        STORE_CHAT_ID,
        user.registrationMessageId,
        undefined,
        {
          type: "photo",
          media: user.profilePhotoFileId,
          caption: info,
          parse_mode: "HTML"
        },
        { reply_markup }
      );
      if (user.registrationMessageType !== "photo") user.registrationMessageType = "photo";
      return edited;
    }

    if (user.registrationMessageType === "photo") {
      await ctx.telegram.editMessageCaption(
        STORE_CHAT_ID,
        user.registrationMessageId,
        undefined,
        info,
        { parse_mode: "HTML", reply_markup }
      );
    } else {
      await ctx.telegram.editMessageText(
        STORE_CHAT_ID,
        user.registrationMessageId,
        undefined,
        info,
        { parse_mode: "HTML", reply_markup }
      );
    }
  } catch (error) {
    const description = String(error?.description || error?.message || "").toLowerCase();
    if (!description.includes("message is not modified")) {
      console.error("refresh registration card:", error);
    }
  }
}

async function ensure(ctx) {
  if (!ctx.from || ctx.chat.type !== "private") return null;
  if (db.isBanned(ctx.from.id)) return null;

  const previous = db.getUser(ctx.from.id);
  if (previous?.blocked) db.markBlocked(ctx.from.id, false);

  let user = db.getUser(ctx.from.id);

  if (user?.threadId) {
    const previousPhotoFileId = user.profilePhotoFileId || "";
    const profile = await fetchProfile(ctx);
    try {
      const photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id, { limit: 1 });
      profile.profilePhotoFileId = photos.total_count && photos.photos[0]?.[0]
        ? photos.photos[0][0].file_id
        : "";
    } catch (error) {
      console.error("refresh user photo:", error);
    }
    user = { ...user, ...profile };
    db.setUser(ctx.from.id, user);
    await refreshRegistrationCard(ctx, user, previousPhotoFileId);
    db.setUser(ctx.from.id, user);
    return user;
  }

  const topic = await ctx.telegram.createForumTopic(STORE_CHAT_ID, topicName(ctx.from));
  const profile = await fetchProfile(ctx);
  let photos = { total_count: 0, photos: [] };
  try {
    photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id, { limit: 1 });
  } catch (error) {
    console.error("get user photo:", error);
  }

  user = {
    ...profile,
    profilePhotoFileId: photos.total_count && photos.photos[0]?.[0]
      ? photos.photos[0][0].file_id
      : "",
    threadId: topic.message_thread_id,
    createdAt: new Date().toISOString(),
    hasConversation: false
  };

  db.setUser(ctx.from.id, user);
  const info = registration(user);

  try {
    const opts = {
      message_thread_id: user.threadId,
      parse_mode: "HTML",
      reply_markup: topicModerationKeyboard().reply_markup
    };

    if (photos.total_count && photos.photos[0]?.[0]) {
      const sent = await ctx.telegram.sendPhoto(
        STORE_CHAT_ID,
        photos.photos[0][0].file_id,
        { ...opts, caption: info }
      );
      user.registrationMessageId = sent.message_id;
      user.registrationMessageType = "photo";
    } else {
      const sent = await ctx.telegram.sendMessage(STORE_CHAT_ID, info, opts);
      user.registrationMessageId = sent.message_id;
      user.registrationMessageType = "text";
    }

    db.setUser(ctx.from.id, user);
  } catch (error) {
    console.error("registration notice:", error);
    const sent = await ctx.telegram.sendMessage(STORE_CHAT_ID, info, {
      message_thread_id: user.threadId,
      parse_mode: "HTML",
      reply_markup: topicModerationKeyboard().reply_markup
    }).catch(() => null);

    if (sent) {
      user.registrationMessageId = sent.message_id;
      user.registrationMessageType = "text";
      db.setUser(ctx.from.id, user);
    }
  }
  return user;
}

async function sendWelcome(ctx) {
  const user = await ensure(ctx);
  if (!user) return ctx.reply("🚫 No tienes acceso a este bot.");

  const stored = db.getWelcomeSource();
  if (stored && await sendStoredSource(ctx, stored, ctx.from, db.getWelcomeButtons())) return;

  const legacy = db.getWelcome();
  const source = typeof legacy === "string" ? { text: legacy, entities: [] } : (legacy || defaultWelcome());
  const html = formatMessageHtml(source.text || "", source.entities || [], ctx.from);
  return ctx.reply(html, { parse_mode: "HTML", ...welcomeKeyboard() });
}

bot.start(sendWelcome);
bot.help((ctx) => ctx.reply("ℹ️ Envía cualquier mensaje para contactar al equipo."));
bot.action("TOPIC_BAN", async (ctx) => {
  await ctx.answerCbQuery();
  const user = await topicUser(ctx);
  if (!user) return ctx.reply("❌ No pude identificar al usuario de este tema.");
  if (db.isBanned(user.userId)) return ctx.reply("🚫 Este usuario ya está baneado.");
  return ctx.reply(
    "⚠️ CONFIRMAR BANEO\n\n👤 " + fullName(user) + "\n🆔 " + user.userId +
    "\n\n¿Quieres bloquear a este usuario?",
    Markup.inlineKeyboard([[
      Markup.button.callback("🔨 CONFIRMAR", "TOPIC_BAN_CONFIRM"),
      Markup.button.callback("❌ CANCELAR", "TOPIC_BAN_CANCEL")
    ]])
  );
});

bot.action("TOPIC_BAN_CONFIRM", async (ctx) => {
  await ctx.answerCbQuery();
  const user = await topicUser(ctx);
  if (!user) return ctx.reply("❌ No pude identificar al usuario de este tema.");
  db.ban(user.userId);
  return ctx.editMessageText(
    "🔨 USUARIO BANEADO\n\n👤 " + fullName(user) + "\n🆔 " + user.userId +
    "\n\nEl bot dejará de atender sus mensajes hasta que sea desbaneado.",
    topicModerationKeyboard()
  );
});

bot.action("TOPIC_BAN_CANCEL", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.editMessageText("❌ Baneo cancelado.", topicModerationKeyboard());
});

bot.action("TOPIC_UNBAN", async (ctx) => {
  await ctx.answerCbQuery();
  const user = await topicUser(ctx);
  if (!user) return ctx.reply("❌ No pude identificar al usuario de este tema.");
  if (!db.isBanned(user.userId)) return ctx.reply("ℹ️ Este usuario no está baneado.");
  db.unban(user.userId);
  return ctx.reply("🔓 Usuario desbaneado. Ya puede volver a utilizar el bot.", topicModerationKeyboard());
});

bot.action("TOPIC_INFO", async (ctx) => {
  await ctx.answerCbQuery();
  const user = await topicUser(ctx);
  if (!user) return ctx.reply("❌ No pude identificar al usuario de este tema.");
  return ctx.reply(
    "ℹ️ INFORMACIÓN DEL USUARIO\n\n" +
    "📝 Nombre: " + fullName(user) + "\n" +
    "🔗 Username: " + (user.username ? "@" + user.username : "Sin username") + "\n" +
    "🆔 ID: " + user.userId + "\n" +
    "⭐ Premium: " + (user.is_premium ? "Sí" : "No") + "\n" +
    "🌐 Idioma: " + (user.language_code || "No disponible") + "\n" +
    "📅 Registro: " + (user.createdAt || "Sin dato") +
    (user.bio ? "\n\n📖 Biografía:\n" + user.bio : "") +
    "\n\n🟢 Estado: " + (db.isBanned(user.userId) ? "Baneado" : (user.blocked ? "No disponible" : "Activo"))
  );
});

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
  return ctx.reply("⚙️ PANEL DE ADMINISTRACIÓN", adminMenu());
});

bot.action("ADMIN_MENU", async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return ctx.editMessageText("⛔ Solo administradores.");
  return ctx.editMessageText("⚙️ PANEL DE ADMINISTRACIÓN", adminMenu());
});

bot.action("ADMIN_STATS", async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;
  const stats = db.getStats();
  return ctx.reply(
    "📊 ESTADÍSTICAS DE USUARIOS\n\n" +
    "👥 Total registrados: " + stats.total + "\n" +
    "🚫 Usuarios que bloquearon al bot: " + stats.blocked + "\n" +
    "🔨 Usuarios baneados: " + stats.banned + "\n" +
    "🧵 Temas registrados: " + stats.activeTopics,
    Markup.inlineKeyboard([
      [Markup.button.callback("🔄 Actualizar", "ADMIN_STATS")],
      [Markup.button.callback("🔙 Panel principal", "ADMIN_MENU")]
    ])
  );
});

bot.action("ADMIN_SCAN_EMPTY", async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;
  const empty = db.getUsers().filter(u => u.threadId && !u.hasConversation);
  if (!empty.length) {
    return ctx.reply(
      "🧹 ESCANEO DE TEMAS\n\n✅ No encontré temas vacíos registrados por el bot.",
      Markup.inlineKeyboard([[Markup.button.callback("🔙 Panel principal", "ADMIN_MENU")]])
    );
  }
  return ctx.reply(
    "🧹 ESCANEO DE TEMAS\n\n" +
    "Encontrados: " + empty.length + " tema(s) sin conversación.\n\n" +
    "Son temas donde el bot solo registró al usuario y no se ha detectado ninguna conversación.\n\n" +
    "¿Quieres eliminarlos todos?",
    Markup.inlineKeyboard([[
      Markup.button.callback("🗑️ ELIMINAR TODOS", "ADMIN_DELETE_EMPTY"),
      Markup.button.callback("❌ CANCELAR", "ADMIN_MENU")
    ]])
  );
});

bot.action("ADMIN_DELETE_EMPTY", async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;
  const empty = db.getUsers().filter(u => u.threadId && !u.hasConversation);
  let deleted = 0;
  let failed = 0;
  for (const user of empty) {
    try {
      await ctx.telegram.deleteForumTopic(STORE_CHAT_ID, user.threadId);
      db.deleteUser(user.userId);
      deleted++;
    } catch (error) {
      failed++;
      console.error("delete empty topic:", user.threadId, error);
    }
  }
  return ctx.editMessageText(
    "🧹 LIMPIEZA COMPLETADA\n\n" +
    "🗑️ Eliminados: " + deleted + "\n" +
    "⚠️ No eliminados: " + failed + "\n\n" +
    "Si alguno de esos usuarios vuelve a usar /start o escribe al bot, se creará un tema nuevo.",
    adminMenu()
  );
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
    "📝 Envía el mensaje de bienvenida exactamente como quieres verlo.\n\nTelegram conservará el formato que tenga el mensaje, incluidos artículos/bloques desplegables, citas, enlaces, spoilers, código, listas y emojis personalizados.\n\nVariables: {mencion} {nombre} {username} {userid}",
    Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "W_MENU")]])
  );
});

bot.action("W_MEDIA", async (ctx) => {
  await ctx.answerCbQuery();
  pending.set(ctx.from.id, { type: "welcome_media" });
  return ctx.reply(
    "🖼️ Envía la multimedia CON el texto/caption que quieras usar.\n\nEl caption conservará el formato de Telegram y admite: {mencion} {nombre} {username} {userid}.",
    Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "W_MENU")]])
  );
});

bot.action("W_BUTTONS", async (ctx) => {
  await ctx.answerCbQuery();
  const buttons = db.getWelcomeButtons();
  const lines = buttons.length ? buttons.map((b, i) => (i + 1) + ". " + b.text + (b.url ? " → " + b.url : "") + (b.style ? " [" + b.style + "]" : "")).join("\n") : "No hay botones configurados.";
  return ctx.reply(
    "🔘 BOTONES DE BIENVENIDA\n\n" + lines + "\n\nFormato:\n#p Texto | https://ejemplo.com\n#r Texto | https://ejemplo.com\n#g Texto | https://ejemplo.com\n\n#p azul • #r rojo • #g verde",
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
  return ctx.reply("🔘 Envía:\n#p Texto | https://ejemplo.com\n\n#p = primary azul\n#r = danger rojo\n#g = success verde");
});
bot.action("W_BTN_CLEAR", async (ctx) => {
  await ctx.answerCbQuery();
  db.setWelcomeButtons([]);
  return ctx.reply("✅ Botones eliminados.", welcomeMenu());
});
bot.action("W_VARS", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply("🧩 VARIABLES\n\n{mencion} → mención clicable del usuario\n{nombre} → nombre completo\n{username} → @username\n{userid} → ID de Telegram");
});
bot.action("W_PREVIEW", async (ctx) => {
  await ctx.answerCbQuery();
  const fakeUser = ctx.from;
  const stored = db.getWelcomeSource();
  if (stored && await sendStoredSource(ctx, stored, fakeUser, db.getWelcomeButtons())) return ctx.reply("👆 Vista previa actual.", welcomeMenu());
  const legacy = db.getWelcome();
  const source = typeof legacy === "string" ? { text: legacy, entities: [] } : (legacy || defaultWelcome());
  await ctx.reply(formatMessageHtml(source.text, source.entities || [], fakeUser), { parse_mode: "HTML", ...welcomeKeyboard() });
  return ctx.reply("👆 Vista previa actual.", welcomeMenu());
});
bot.action("W_DELETE", async (ctx) => {
  await ctx.answerCbQuery();
  db.clearWelcome();
  pending.delete(ctx.from.id);
  return ctx.reply("🗑️ Bienvenida eliminada. Se usará la predeterminada.", welcomeMenu());
});

bot.action("QR_MENU", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.editMessageText("⚡ RESPUESTAS RÁPIDAS\n\nCrea una palabra o comando y luego configura su contenido desde un submenú.", Markup.inlineKeyboard([
    [Markup.button.callback("➕ Crear palabra/comando", "QR_ADD")],
    [Markup.button.callback("📋 Mis respuestas", "QR_LIST")],
    [Markup.button.callback("🗑️ Eliminar", "QR_DELETE")],
    [Markup.button.callback("🔙 Volver", "W_MENU")]
  ]));
});
bot.action("QR_ADD", async (ctx) => {
  await ctx.answerCbQuery();
  pending.set(ctx.from.id, { type: "quick_command" });
  return ctx.reply("1️⃣ Escribe la palabra o comando que activará la respuesta.\n\nEjemplos: contacto  o  /contacto");
});
bot.action("QR_LIST", async (ctx) => {
  await ctx.answerCbQuery();
  const items = Object.entries(db.getQuickResponses());
  if (!items.length) return ctx.reply("📋 No hay respuestas rápidas.", quickMenu());
  const text = items.map(([cmd, v]) => {
    const parts = [];
    if (v.textSource || v.text) parts.push("texto");
    if (v.mediaSource || v.source) parts.push("multimedia");
    if (v.buttons?.length) parts.push(v.buttons.length + " botón(es)");
    return "• " + (cmd.startsWith("/") ? cmd : "/" + cmd) + " — " + (parts.join(" + ") || "vacía");
  }).join("\n");
  return ctx.reply("📋 RESPUESTAS RÁPIDAS\n\n" + text, Markup.inlineKeyboard([
    [Markup.button.callback("➕ Crear otra", "QR_ADD")],
    [Markup.button.callback("🔙 Volver", "QR_MENU")]
  ]));
});
bot.action("QR_DELETE", async (ctx) => {
  await ctx.answerCbQuery();
  if (!Object.keys(db.getQuickResponses()).length) return ctx.reply("No hay respuestas para eliminar.", quickMenu());
  pending.set(ctx.from.id, { type: "quick_delete" });
  return ctx.reply("🗑️ Escribe la palabra/comando que quieres eliminar.");
});

bot.action("QR_CONFIG", async (ctx) => {
  await ctx.answerCbQuery();
  const p = pending.get(ctx.from.id);
  if (!p?.command) return ctx.reply("❌ No hay una respuesta en edición.");
  return ctx.editMessageText("⚡ CONFIGURAR: " + p.command + "\n\nSelecciona qué quieres agregar o modificar:", quickMenu(p.command));
});
bot.action("QR_TEXT", async (ctx) => {
  await ctx.answerCbQuery();
  const p = pending.get(ctx.from.id);
  if (!p?.command) return ctx.reply("❌ No hay una respuesta en edición.");
  pending.set(ctx.from.id, { ...p, type: "quick_text" });
  return ctx.reply("📝 Envía el texto. Se conservará el formato exacto de Telegram, incluido el formato de artículos/bloques desplegables, citas, listas, enlaces, código, spoilers y emojis personalizados.");
});
bot.action("QR_MEDIA", async (ctx) => {
  await ctx.answerCbQuery();
  const p = pending.get(ctx.from.id);
  if (!p?.command) return ctx.reply("❌ No hay una respuesta en edición.");
  pending.set(ctx.from.id, { ...p, type: "quick_media" });
  return ctx.reply("🖼️ Envía la multimedia CON su caption/texto. El caption conservará el formato de Telegram y acepta {mencion}, {nombre}, {username} y {userid}.");
});
bot.action("QR_BUTTONS", async (ctx) => {
  await ctx.answerCbQuery();
  const p = pending.get(ctx.from.id);
  if (!p?.command) return ctx.reply("❌ No hay una respuesta en edición.");
  return ctx.reply("🔘 BOTONES STYLE PARA " + p.command, quickButtonMenu());
});
bot.action("QR_BTN_ADD", async (ctx) => {
  await ctx.answerCbQuery();
  const p = pending.get(ctx.from.id);
  if (!p?.command) return ctx.reply("❌ No hay una respuesta en edición.");
  pending.set(ctx.from.id, { ...p, type: "quick_button" });
  return ctx.reply("🔘 Envía:\n#p Texto | https://ejemplo.com\n#r Texto | https://ejemplo.com\n#g Texto | https://ejemplo.com");
});
bot.action("QR_BTN_CLEAR", async (ctx) => {
  await ctx.answerCbQuery();
  const p = pending.get(ctx.from.id);
  if (!p?.command) return ctx.reply("❌ No hay una respuesta en edición.");
  db.setQuickResponse(p.command, { buttons: [] });
  return ctx.reply("✅ Botones eliminados.", quickButtonMenu());
});
bot.action("QR_PREVIEW", async (ctx) => {
  await ctx.answerCbQuery();
  const p = pending.get(ctx.from.id);
  if (!p?.command) return ctx.reply("❌ No hay una respuesta en edición.");
  const quick = db.getQuickResponse(p.command);
  if (!quick) return ctx.reply("❌ No existe esa respuesta.");
  const source = quick.mediaSource || quick.source;
  if (source && await sendStoredSource(ctx, source, ctx.from, quick.buttons || [])) return;
  const textSource = quick.textSource || (quick.text ? { text: quick.text, entities: [] } : null);
  if (textSource) await ctx.reply(formatMessageHtml(textSource.text, textSource.entities || [], ctx.from), { parse_mode: "HTML", ...Markup.inlineKeyboard((quick.buttons || []).map((b) => [styleButton(b.text, b.url, b.callback, b.style)])) });
  else await ctx.reply("⚠️ La respuesta aún no tiene contenido.");
});
bot.action("QR_DONE", async (ctx) => {
  await ctx.answerCbQuery();
  const p = pending.get(ctx.from.id);
  if (!p?.command) return ctx.reply("❌ No hay una respuesta en edición.");
  pending.delete(ctx.from.id);
  return ctx.reply("✅ Respuesta " + p.command + " guardada.", quickMenu());
});

bot.command("ban", (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Solo administradores.");
  const id = Number((ctx.message?.text || "").split(/\s+/)[1]);
  if (!id) return ctx.reply("Uso: /ban ID");
  db.ban(id); return ctx.reply("🚫 Usuario bloqueado.");
});
bot.command("unban", (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.reply("⛔ Solo administradores.");
  const id = Number((ctx.message?.text || "").split(/\s+/)[1]);
  if (!id) return ctx.reply("Uso: /unban ID");
  db.unban(id); return ctx.reply("✅ Usuario desbloqueado.");
});

bot.on("message", async (ctx, next) => {
  if (ctx.chat.type === "private" && ctx.from && db.isBanned(ctx.from.id)) {
    return ctx.reply("🚫 Tu acceso a APORTES-BOT está bloqueado.");
  }

  const p = pending.get(ctx.from?.id);

  if (p && isAdmin(ctx.from.id) && ctx.chat.type === "private") {
    if (p.type === "welcome_text" && (ctx.message.text !== undefined || ctx.message.caption !== undefined)) {
      const source = sourceFromMessage(ctx);
      if (source.media) return ctx.reply("❌ Para texto usa solo un mensaje de texto. Para multimedia + texto usa 🖼️ Multimedia.");
      db.setWelcome({ text: source.text, entities: source.entities });
      db.setWelcomeSource({ ...source, media: false });
      pending.delete(ctx.from.id);
      return ctx.reply("✅ Bienvenida de texto guardada.", welcomeMenu());
    }

    if (p.type === "welcome_media" && !ctx.message.text?.startsWith("/")) {
      const source = sourceFromMessage(ctx);
      if (!source.media) return ctx.reply("❌ Envía una multimedia con su texto/caption.");
      db.setWelcomeSource(source);
      db.setWelcome(null);
      pending.delete(ctx.from.id);
      return ctx.reply("✅ Bienvenida multimedia + texto guardada.", welcomeMenu());
    }

    if (p.type === "welcome_button" && ctx.message.text) {
      const parts = ctx.message.text.split("|").map((x) => x.trim());
      if (parts.length < 2 || !parts[0] || !/^https?:\/\//i.test(parts[1])) return ctx.reply("❌ Usa: #p Texto | https://ejemplo.com");
      let label = parts[0], style;
      const match = label.match(/^#([prg])\s+/i);
      if (match) { style = ({p:"primary",r:"danger",g:"success"})[match[1].toLowerCase()]; label = label.replace(/^#[prg]\s+/i,"").trim(); }
      const buttons = db.getWelcomeButtons();
      buttons.push({ text: label, url: parts[1], style });
      db.setWelcomeButtons(buttons);
      pending.delete(ctx.from.id);
      return ctx.reply("✅ Botón agregado.", welcomeMenu());
    }

    if (p.type === "quick_command" && ctx.message.text) {
      let command = ctx.message.text.trim().replace(/^\//, "").toLowerCase();
      if (!/^[a-z0-9_]{2,32}$/.test(command)) return ctx.reply("❌ Nombre inválido. Usa 2-32 caracteres: letras, números y _.");
      if (["start","help","info","status","cancel","admin","setwelcome","ban","unban"].includes(command)) return ctx.reply("❌ Ese comando está reservado.");
      db.setQuickResponse(command, { textSource: null, mediaSource: null, buttons: [] });
      pending.set(ctx.from.id, { type: "quick_config", command });
      return ctx.reply("2️⃣ Respuesta " + command + " creada. Ahora elige qué configurar:", quickMenu(command));
    }

    if (p.type === "quick_text" && (ctx.message.text !== undefined || ctx.message.caption !== undefined)) {
      const source = sourceFromMessage(ctx);
      if (source.media) return ctx.reply("❌ Aquí usa solo texto. Para multimedia usa 🖼️ Multimedia + texto.");
      db.setQuickResponse(p.command, { textSource: { text: source.text, entities: source.entities, chatId: source.chatId, messageId: source.messageId } });
      pending.set(ctx.from.id, { type: "quick_config", command: p.command });
      return ctx.reply("✅ Texto guardado.", quickMenu(p.command));
    }

    if (p.type === "quick_media" && !ctx.message.text?.startsWith("/")) {
      const source = sourceFromMessage(ctx);
      if (!source.media) return ctx.reply("❌ Envía una multimedia con caption/texto.");
      db.setQuickResponse(p.command, { mediaSource: source });
      pending.set(ctx.from.id, { type: "quick_config", command: p.command });
      return ctx.reply("✅ Multimedia + texto guardados.", quickMenu(p.command));
    }

    if (p.type === "quick_button" && ctx.message.text) {
      const parts = ctx.message.text.split("|").map((x) => x.trim());
      if (parts.length < 2 || !parts[0] || !/^https?:\/\//i.test(parts[1])) return ctx.reply("❌ Usa: #p Texto | https://ejemplo.com");
      let label = parts[0], style;
      const match = label.match(/^#([prg])\s+/i);
      if (match) { style = ({p:"primary",r:"danger",g:"success"})[match[1].toLowerCase()]; label = label.replace(/^#[prg]\s+/i,"").trim(); }
      const buttons = db.getQuickResponse(p.command)?.buttons || [];
      buttons.push({ text: label, url: parts[1], style });
      db.setQuickResponse(p.command, { buttons });
      pending.set(ctx.from.id, { type: "quick_config", command: p.command });
      return ctx.reply("✅ Botón agregado.", quickButtonMenu());
    }

    if (p.type === "quick_delete" && ctx.message.text) {
      const command = ctx.message.text.trim().replace(/^\//, "").toLowerCase();
      if (!db.getQuickResponse(command)) return ctx.reply("❌ Esa respuesta no existe.");
      db.deleteQuickResponse(command);
      pending.delete(ctx.from.id);
      return ctx.reply("🗑️ Eliminada.", quickMenu());
    }
  }

  if (ctx.chat.type === "private") {
    const raw = ctx.message.text?.trim();
    if (raw?.startsWith("/")) {
      const command = raw.split(/\s+/)[0].slice(1).split("@")[0].toLowerCase();
      const quick = db.getQuickResponse(command);
      if (quick) {
        const source = quick.mediaSource || quick.source;
        if (source && await sendStoredSource(ctx, source, ctx.from, quick.buttons || [])) return;
        const textSource = quick.textSource || (quick.text ? { text: quick.text, entities: [] } : null);
        if (textSource) return ctx.reply(formatMessageHtml(textSource.text, textSource.entities || [], ctx.from), { parse_mode: "HTML", ...Markup.inlineKeyboard(quick.buttons || []) });
      }
      return;
    }

    const word = raw?.toLowerCase();
    if (word) {
      const quick = db.getQuickResponse(word);
      if (quick) {
        const source = quick.mediaSource || quick.source;
        if (source && await sendStoredSource(ctx, source, ctx.from, quick.buttons || [])) return;
        const textSource = quick.textSource || (quick.text ? { text: quick.text, entities: [] } : null);
        if (textSource) return ctx.reply(formatMessageHtml(textSource.text, textSource.entities || [], ctx.from), { parse_mode: "HTML", ...Markup.inlineKeyboard(quick.buttons || []) });
      }
    }

    const user = await ensure(ctx);
    if (!user) return;
    try {
      await ctx.telegram.copyMessage(STORE_CHAT_ID, ctx.chat.id, ctx.message.message_id, { message_thread_id: user.threadId });
    } catch (error) { console.error("copy user:", error); }
    return;
  }

  if (Number(ctx.chat.id) !== STORE_CHAT_ID || !ctx.message.message_thread_id) return;
  if (ctx.message.text?.startsWith("/")) return;

  const user = db.markActivityByThread(ctx.message.message_thread_id);
  if (!user) return;
  try {
    await ctx.telegram.copyMessage(user.userId, ctx.chat.id, ctx.message.message_id);
  } catch (error) {
    console.error("copy admin:", error);
    const description = String(error?.description || error?.message || "").toLowerCase();
    const blocked = description.includes("bot was blocked by the user") ||
      description.includes("user is deactivated") ||
      description.includes("chat not found");
    if (blocked && !user.blocked) {
      db.markBlocked(user.userId, true);
      await ctx.telegram.sendMessage(
        STORE_CHAT_ID,
        "🚫 AVISO DE USUARIO\n\n👤 " + fullName(user) +
        "\n🆔 " + user.userId +
        "\n\nEl usuario bloqueó al bot o ya no está disponible.\n📊 Se contará en Estadísticas como: «Usuarios que bloquearon al bot».",
        { message_thread_id: user.threadId }
      ).catch(() => {});
    }
  }

  if (next) return next();
});

bot.catch((error) => console.error("Telegraf:", error));
bot.launch({ dropPendingUpdates: false }).then(() => console.log("🤖 APORTES-BOT iniciado."));
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
