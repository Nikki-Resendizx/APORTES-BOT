const BOT_TOKEN = process.env.BOT_TOKEN;
const STORE_CHAT_ID = Number(process.env.STORE_CHAT_ID || 0);
const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(",").map(x => Number(x.trim())).filter(Number.isInteger);
const TIMEZONE = process.env.TIMEZONE || "America/Mexico_City";
module.exports = { BOT_TOKEN, STORE_CHAT_ID, ADMIN_IDS, TIMEZONE };
