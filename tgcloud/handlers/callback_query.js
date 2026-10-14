import { api } from 'sdk';
import { STORE_CHAT_ID, isAdmin } from '../lib/config.js';
import { getUser, findByThread, setBanned, setUnbanned, isBanned } from '../lib/state.js';

export default async function (query) {
  const data = String(query?.data || '');
  const userId = Number(query?.from?.id || 0);
  if (query?.id) {
    await api.answerCallbackQuery({ callback_query_id: query.id });
  }

  if (data === 'INFO') {
    await api.sendMessage({ chat_id: userId, text: '👤 Tu ID de Telegram: ' + userId });
    return;
  }

  const [action, rawId] = data.split(':');
  const targetId = Number(rawId || 0);
  if (!targetId || !['TOPIC_BAN', 'TOPIC_UNBAN', 'TOPIC_INFO'].includes(action)) return;

  // Only configured administrators may moderate users from the topic card.
  if (!isAdmin(userId)) {
    await api.sendMessage({ chat_id: userId, text: '⛔ Solo administradores.' });
    return;
  }

  const user = await getUser(targetId);
  if (!user) {
    await api.sendMessage({ chat_id: STORE_CHAT_ID, text: '❌ No encontré ese usuario en la base de datos.' });
    return;
  }

  if (action === 'TOPIC_BAN') {
    if (await isBanned(targetId)) {
      await api.sendMessage({ chat_id: STORE_CHAT_ID, message_thread_id: user.threadId, text: '🚫 Este usuario ya está baneado.' });
      return;
    }
    await setBanned(targetId, userId, 'Baneo desde la tarjeta del usuario');
    await api.sendMessage({ chat_id: STORE_CHAT_ID, message_thread_id: user.threadId, text: '🔨 Usuario baneado. El bot dejará de atender sus mensajes.' });
    return;
  }

  if (action === 'TOPIC_UNBAN') {
    await setUnbanned(targetId);
    await api.sendMessage({ chat_id: STORE_CHAT_ID, message_thread_id: user.threadId, text: '🔓 Usuario desbaneado.' });
    return;
  }

  if (action === 'TOPIC_INFO') {
    const p = user.profile || {};
    await api.sendMessage({
      chat_id: STORE_CHAT_ID, message_thread_id: user.threadId,
      text: 'ℹ️ INFORMACIÓN DEL USUARIO\n\n' +
        '📝 Nombre: ' + [p.first_name, p.last_name].filter(Boolean).join(' ') +
        '\n🔗 Username: ' + (p.username ? '@' + p.username : 'Sin username') +
        '\n🆔 ID: ' + user.userId +
        '\n⭐ Premium: ' + (p.is_premium ? 'Sí' : 'No') +
        '\n🌐 Idioma: ' + (p.language_code || 'No disponible') +
        '\n📅 Registro: ' + new Date(user.createdAt * 1000).toISOString() +
        '\n🟢 Estado: ' + (await isBanned(user.userId) ? 'Baneado' : (user.blocked ? 'No disponible' : 'Activo')),
    });
  }
}
