require("dotenv").config();
const { Telegraf } = require("telegraf");

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("Falta la variable de entorno BOT_TOKEN.");
  process.exit(1);
}

const bot = new Telegraf(token);

bot.start(async (ctx) => {
  await ctx.reply(
    "👋 Bienvenido. Este bot es un canal de contacto.\n\nTu mensaje será enviado al equipo correspondiente."
  );
});

bot.help(async (ctx) => {
  await ctx.reply("ℹ️ Usa /start para iniciar el contacto.");
});

bot.command("cancel", async (ctx) => {
  await ctx.reply("❌ Operación cancelada.");
});

bot.catch((err, ctx) => {
  console.error("Error del bot:", err);
});

bot.launch({
  dropPendingUpdates: false
}).then(() => {
  console.log("🤖 APORTES-BOT iniciado correctamente.");
}).catch((err) => {
  console.error("No se pudo iniciar el bot:", err);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
