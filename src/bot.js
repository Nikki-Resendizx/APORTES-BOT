require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const token = process.env.BOT_TOKEN;
const adminIds = (process.env.ADMIN_IDS || "").split(",").map(v => v.trim()).filter(Boolean);
const adminChatId = process.env.ADMIN_CHAT_ID?.trim() || "";
const sessions = new Map();

if (!token) {
  console.error("❌ Falta BOT_TOKEN en las variables de entorno.");
  process.exit(1);
}

const bot = new Telegraf(token);

const menu = () => Markup.inlineKeyboard([
  [Markup.button.callback("📩 ENVIAR APORTE", "contribution")],
  [
    Markup.button.callback("👤 MI INFORMACIÓN", "info"),
    Markup.button.callback("❓ AYUDA", "help")
  ],
  [Markup.button.callback("❌ CANCELAR", "cancel")]
]);

const html = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function targets() {
  return [...new Set([...adminIds, ...(adminChatId ? [adminChatId] : [])])];
}

function userInfo(ctx) {
  const u = ctx.from;
  return [
    "📥 <b>NUEVO APORTE</b>",
    "",
    `👤 <b>Nombre:</b> ${html([u.first_name, u.last_name].filter(Boolean).join(" ") || "Usuario")}`,
    `🆔 <b>ID:</b> <code>${u.id}</code>`,
    `🔗 <b>Username:</b> ${u.username ? "@" + html(u.username) : "sin username"}`,
    `🌐 <b>Idioma:</b> ${html(u.language_code || "no disponible")}`
  ].join("\n");
}

async function forwardContribution(ctx) {
  const recipients = targets();

  if (!recipients.length) {
    await ctx.reply("⚠️ El bot todavía no tiene configurado un destinatario administrativo.");
    return;
  }

  for (const recipient of recipients) {
    try {
      await ctx.telegram.sendMessage(recipient, userInfo(ctx), { parse_mode: "HTML" });

      const message = ctx.message;

      if (message.text) {
        await ctx.telegram.sendMessage(recipient, html(message.text), { parse_mode: "HTML" });
      } else if (message.photo) {
        await ctx.telegram.sendPhoto(
          recipient,
          message.photo[message.photo.length - 1].file_id,
          { caption: html(message.caption || "") }
        );
      } else if (message.video) {
        await ctx.telegram.sendVideo(recipient, message.video.file_id, {
          caption: html(message.caption || "")
        });
      } else if (message.document) {
        await ctx.telegram.sendDocument(recipient, message.document.file_id, {
          caption: html(message.caption || "")
        });
      } else if (message.audio) {
        await ctx.telegram.sendAudio(recipient, message.audio.file_id, {
          caption: html(message.caption || "")
        });
      } else if (message.voice) {
        await ctx.telegram.sendVoice(recipient, message.voice.file_id);
      } else {
        await ctx.telegram.sendMessage(recipient, "📎 Se recibió un tipo de contenido no compatible.");
      }
    } catch (error) {
      console.error(`❌ Error enviando a ${recipient}:`, error.message);
    }
  }

  sessions.delete(ctx.from.id);

  await ctx.reply(
    "✅ <b>Aporte recibido correctamente.</b>\n\nTu contenido fue enviado al administrador.",
    { parse_mode: "HTML", ...menu() }
  );
}

bot.start(async (ctx) => {
  sessions.delete(ctx.from.id);

  await ctx.reply(
    "👋 <b>Bienvenido a APORTES-BOT</b>\n\n" +
    "📩 Desde aquí puedes enviar tus aportes directamente al administrador.\n\n" +
    "📎 Puedes enviar texto, fotos, videos, documentos, audio o notas de voz.\n\n" +
    "🔒 El bot no necesita una base de datos para gestionar el envío.",
    { parse_mode: "HTML", ...menu() }
  );
});

bot.help(async (ctx) => {
  await ctx.reply(
    "❓ <b>AYUDA</b>\n\n" +
    "1️⃣ Pulsa <b>📩 ENVIAR APORTE</b>.\n" +
    "2️⃣ Envía tu contenido.\n" +
    "3️⃣ El administrador lo recibirá junto con tus datos básicos.\n\n" +
    "Puedes usar /cancel en cualquier momento.",
    { parse_mode: "HTML", ...menu() }
  );
});

bot.command("cancel", async (ctx) => {
  sessions.delete(ctx.from.id);
  await ctx.reply("❌ Operación cancelada.", menu());
});

bot.action("contribution", async (ctx) => {
  await ctx.answerCbQuery();
  sessions.set(ctx.from.id, { mode: "contribution" });

  await ctx.reply(
    "📩 <b>ENVIAR APORTE</b>\n\n" +
    "Envía ahora tu contenido.\n\n" +
    "Acepto texto, fotos, videos, documentos, audio y notas de voz.\n\n" +
    "Usa /cancel para cancelar.",
    { parse_mode: "HTML" }
  );
});

bot.action("info", async (ctx) => {
  await ctx.answerCbQuery();
  const u = ctx.from;

  await ctx.reply(
    `👤 <b>MI INFORMACIÓN</b>\n\n🆔 ID: <code>${u.id}</code>\n👤 Nombre: ${html([u.first_name, u.last_name].filter(Boolean).join(" ") || "Usuario")}\n🔗 Username: ${u.username ? "@" + html(u.username) : "Sin username"}\n🌐 Idioma: ${html(u.language_code || "no disponible")}`,
    { parse_mode: "HTML", ...menu() }
  );
});

bot.action("help", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "❓ <b>AYUDA</b>\n\n📩 <b>Enviar aporte:</b> inicia un envío al administrador.\n👤 <b>Mi información:</b> muestra tus datos básicos.\n❌ <b>Cancelar:</b> cancela el envío actual.\n\nTambién puedes usar /cancel.",
    { parse_mode: "HTML", ...menu() }
  );
});

bot.action("cancel", async (ctx) => {
  await ctx.answerCbQuery();
  sessions.delete(ctx.from.id);
  await ctx.reply("❌ Operación cancelada.", menu());
});

bot.on("message", async (ctx) => {
  if (ctx.message?.text?.startsWith("/")) return;

  if (sessions.get(ctx.from.id)?.mode !== "contribution") {
    await ctx.reply("ℹ️ Primero pulsa 📩 ENVIAR APORTE para iniciar un envío.", menu());
    return;
  }

  try {
    await forwardContribution(ctx);
  } catch (error) {
    console.error("❌ Error procesando aporte:", error);
    await ctx.reply("⚠️ No pude procesar el aporte. Intenta nuevamente.");
  }
});

bot.catch((error) => {
  console.error("❌ Error global del bot:", error);
});

bot.launch({ dropPendingUpdates: false })
  .then(() => console.log("🤖 APORTES-BOT iniciado correctamente."))
  .catch((error) => {
    console.error("❌ No se pudo iniciar APORTES-BOT:", error);
    process.exit(1);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
