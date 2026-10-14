// Telegram Serverless configuration for APORTES-BOT.
// Keep IDs numeric. Never commit bot tokens or Serverless CLI credentials.
export const STORE_CHAT_ID = -1004256723476;
export const ADMIN_IDS = [8481421930, 8719034760, 8624574996, 8759521594];
export const TIMEZONE = 'America/Mexico_City';

export function isAdmin(id) {
  return ADMIN_IDS.includes(Number(id));
}
