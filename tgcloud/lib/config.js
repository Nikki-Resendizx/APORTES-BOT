// Fill these values before the first deployment.
// STORE_CHAT_ID is the numeric ID of the Telegram forum group.
// ADMIN_IDS are Telegram numeric user IDs, not usernames.
export const STORE_CHAT_ID = 0;
export const ADMIN_IDS = [];
export const TIMEZONE = 'America/Mexico_City';

export function isAdmin(id) {
  return ADMIN_IDS.includes(Number(id));
}
