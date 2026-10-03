const db = require("./storage");

const TOPICS = {
  users: "👤 REGISTRO DE USUARIOS",
  clones: "🤖 REGISTRO DE CLONES",
  premium: "💎 SOLICITUDES PREMIUM"
};

function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function ensureRegistryTopics(telegram, chatId) {
  const current = db.getRegistries();
  const topics = { ...(current.topics || {}) };
  for (const [key, name] of Object.entries(TOPICS)) {
    if (topics[key]) continue;
    const topic = await telegram.createForumTopic(chatId, name);
    topics[key] = topic.message_thread_id;
  }
  db.setRegistries({ chatId: Number(chatId), topics });
  return { chatId: Number(chatId), topics };
}

async function ensureConfigured(telegram) {
  const config = db.getRegistries();
  if (!config.chatId) return null;
  try {
    return await ensureRegistryTopics(telegram, config.chatId);
  } catch (error) {
    console.error("registry topics:", error);
    return null;
  }
}

async function send(telegram, type, text, extra = {}) {
  const config = await ensureConfigured(telegram);
  if (!config?.topics?.[type]) return null;
  return telegram.sendMessage(config.chatId, text, {
    message_thread_id: config.topics[type],
    parse_mode: "HTML",
    ...extra
  });
}

async function logUser(telegram, user) {
  const premium = db.getPremium(user.userId);
  return send(telegram, "users",
    "👤 <b>NUEVO USUARIO</b>\n\n" +
    "📝 <b>Nombre:</b> " + esc([user.first_name, user.last_name].filter(Boolean).join(" ") || "Sin nombre") + "\n" +
    "🔗 <b>Username:</b> " + (user.username ? "@" + esc(user.username) : "Sin username") + "\n" +
    "🆔 <b>ID:</b> <code>" + user.userId + "</code>\n" +
    "⭐ <b>Premium:</b> " + (premium.active ? "Sí" : "No") + "\n" +
    "🌐 <b>Idioma:</b> " + esc(user.language_code || "N/D") + "\n" +
    "📅 <b>Registro:</b> " + esc(user.createdAt || new Date().toISOString()) + "\n" +
    "🟢 <b>Estado:</b> Activo");
}

async function logClone(telegram, owner, clone) {
  return send(telegram, "clones",
    "🤖 <b>NUEVO CLON</b>\n\n" +
    "👤 <b>Propietario:</b> " + esc(owner?.first_name || owner?.name || "Sin nombre") + "\n" +
    "🔗 <b>Username:</b> " + (owner?.username ? "@" + esc(owner.username) : "Sin username") + "\n" +
    "🆔 <b>ID propietario:</b> <code>" + clone.ownerId + "</code>\n" +
    "🤖 <b>Bot:</b> " + esc(clone.name || "Sin nombre") + (clone.username ? " @" + esc(clone.username) : "") + "\n" +
    "🆔 <b>Bot ID:</b> <code>" + clone.botId + "</code>\n" +
    "📅 <b>Creado:</b> " + esc(clone.createdAt || new Date().toISOString()) + "\n" +
    "🟢 <b>Estado:</b> " + esc(clone.status || "starting"));
}

async function logPremiumRequest(telegram, request) {
  return send(telegram, "premium",
    "💎 <b>SOLICITUD PREMIUM</b>\n\n" +
    "👤 <b>Usuario:</b> " + esc(request.name || "Sin nombre") + "\n" +
    "🔗 <b>Username:</b> " + (request.username ? "@" + esc(request.username) : "Sin username") + "\n" +
    "🆔 <b>ID:</b> <code>" + request.userId + "</code>\n" +
    "🎁 <b>Plan:</b> " + esc(request.plan || "N/D") + "\n" +
    "💳 <b>Método:</b> " + esc(request.method || "Telegram Stars") + "\n" +
    "💰 <b>Importe:</b> " + esc(request.amount || "N/D") + "\n" +
    "📅 <b>Solicitud:</b> " + esc(request.createdAt || new Date().toISOString()) + "\n" +
    "🟡 <b>Estado:</b> " + esc(request.status || "PENDIENTE"),
    request.reply_markup ? { reply_markup: request.reply_markup } : {});
}

module.exports = { TOPICS, ensureRegistryTopics, logUser, logClone, logPremiumRequest };
