import { api } from 'sdk';
import { STORE_CHAT_ID, TIMEZONE } from '../lib/config.js';
import { getUser, saveUser, findByThread, getSetting, isBanned } from '../lib/state.js';

const now = () => Math.floor(Date.now() / 1000);
const fullName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'Sin nombre';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mention = (u) => '<a href="tg://user?id=' + Number(u.id) + '">' + esc(fullName(u)) + '</a>';
const isForwarded = (m) => Boolean(m.forward_origin || m.forward_from || m.forward_from_chat || m.forward_sender_name || m.is_automatic_forward);

function substitute(text, user) {
  const p = user.profile || {};
  const values = {
    mencion: mention(p), nombre: esc(fullName(p)),
    username: esc(p.username ? '@' + p.username : 'Sin username'),
    userid: String(user.userId), premium: p.is_premium ? 'Sí' : 'No',
    idioma: esc(p.language_code || 'No disponible'),
    registro: esc(new Date((user.createdAt || now()) * 1000).toLocaleString('es-MX', { timeZone: TIMEZONE, hour12: false })),
    biografia: esc(p.bio || ''), estado: user.blocked ? 'No disponible' : 'Activo', timezone: TIMEZONE,
  };
  return String(text || '').replace(/\{(mencion|nombre|username|userid|premium|idioma|registro|biografia|estado|timezone)\}/gi, (_, k) => values[k.toLowerCase()] ?? '');
}

async function getProfile(message) {
  const u = message.from || {};
  let bio = '';
  try {
    const chat = await api.getChat({ chat_id: u.id });
    bio = chat.bio || '';
  } catch {}
  return {
    id: Number(u.id), first_name: u.first_name || '', last_name: u.last_name || '',
    username: u.username || '', is_premium: Boolean(u.is_premium),
    language_code: u.language_code || '', bio,
  };
}

async function ensureUser(message) {
  const profile = await getProfile(message);
  let user = await getUser(profile.id);
  if (await isBanned(profile.id)) return null;

  if (user?.threadId) {
    try {
      await api.sendChatAction({ chat_id: STORE_CHAT_ID, action: 'typing', message_thread_id: user.threadId });
      user = { ...user, profile, blocked: false, lastActivityAt: now() };
      await saveUser(user);
      return user;
    } catch (error) {
      const msg = String(error?.description || error?.message || error).toLowerCase();
      if (!msg.includes('thread') && !msg.includes('topic')) throw error;
      // Only recreate the topic if Telegram explicitly says the old thread is gone.
    }
  }

  const topic = await api.createForumTopic({ chat_id: STORE_CHAT_ID, name: (fullName(profile) + ' • ' + profile.id).slice(0, 128) });
  user = {
    userId: profile.id, threadId: topic.message_thread_id,
    registrationMessageId: null, registrationMessageType: 'text',
    profilePhotoFileId: null, blocked: false, createdAt: user?.createdAt || now(),
    lastActivityAt: now(), conversationStartedAt: null, profile,
  };

  try {
    const photos = await api.getUserProfilePhotos({ user_id: profile.id, limit: 1 });
    const photo = photos.total_count && photos.photos?.[0]?.[0];
    if (photo?.file_id) user.profilePhotoFileId = photo.file_id;
  } catch {}

  await saveUser(user);
  const card = [
    '👤 <b>NUEVO USUARIO</b>', '',
    '📝 Nombre: ' + mention(profile),
    '🔗 Username: ' + esc(profile.username ? '@' + profile.username : 'Sin username'),
    '🆔 ID: ' + profile.id,
    '⭐ Premium: ' + (profile.is_premium ? 'Sí' : 'No'),
    '🌐 Idioma: ' + esc(profile.language_code || 'No disponible'),
    '📅 Registro: ' + esc(new Date(user.createdAt * 1000).toLocaleString('es-MX', { timeZone: TIMEZONE, hour12: false })),
    '📖 Biografía: ' + esc(profile.bio || 'No disponible'),
  ].join('\n');
  const keyboard = { inline_keyboard: [[
    { text: '🚷 Banear', callback_data: 'TOPIC_BAN:' + profile.id, style: 'danger' },
    { text: '🚹 Desbanear', callback_data: 'TOPIC_UNBAN:' + profile.id, style: 'success' },
  ], [{ text: 'ℹ️ Información', callback_data: 'TOPIC_INFO:' + profile.id, style: 'primary' }]] };

  let sent;
  if (user.profilePhotoFileId) {
    sent = await api.sendPhoto({
      chat_id: STORE_CHAT_ID, photo: user.profilePhotoFileId,
      caption: card, parse_mode: 'HTML', message_thread_id: user.threadId,
      reply_markup: keyboard,
    });
    user.registrationMessageType = 'photo';
  } else {
    sent = await api.sendMessage({
      chat_id: STORE_CHAT_ID, text: card, parse_mode: 'HTML',
      message_thread_id: user.threadId, reply_markup: keyboard,
    });
  }
  user.registrationMessageId = sent.message_id;
  await saveUser(user);
  return user;
}

async function sendWelcome(message, user) {
  const saved = await getSetting('welcomeText', null);
  const text = substitute(saved || '👋 Bienvenido.\n\nEnvía tu mensaje y será enviado al equipo.\n\n{nombre} • {username} • {userid}', user);
  const buttons = await getSetting('welcomeButtons', []);
  const markup = buttons.length ? { inline_keyboard: buttons.map((b) => [{
    text: b.text, ...(b.url ? { url: b.url } : { callback_data: b.callback || 'INFO' }),
    ...(b.style ? { style: b.style } : {}),
  }]) } : undefined;
  await api.sendMessage({ chat_id: message.chat.id, text, parse_mode: 'HTML', ...(markup ? { reply_markup: markup } : {}) });
}

export default async function (message) {
  if (!message?.chat || !message.from || message.from.is_bot) return;
  const chatId = Number(message.chat.id);
  const text = String(message.text || '').trim();
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

  if (message.chat.type === 'private') {
    if (command === '/start') {
      const user = await ensureUser(message);
      if (!user) {
        await api.sendMessage({ chat_id: chatId, text: '🚫 No tienes acceso a este bot.' });
        return;
      }
      await sendWelcome(message, user);
      return;
    }
    if (command === '/help') {
      await api.sendMessage({ chat_id: chatId, text: '🔥 APORTES-BOT\n\nEnvía tu aporte como mensaje, foto, video, álbum o archivo.\n\nComandos: /start, /help, /info, /status, /cancel' });
      return;
    }
    if (command === '/info') {
      const user = await getUser(message.from.id);
      await api.sendMessage({ chat_id: chatId, text: '👤 ' + fullName(message.from) + '\n🆔 ' + message.from.id + '\n🧵 Tema: ' + (user?.threadId || 'no creado') });
      return;
    }
    if (command === '/status') {
      await api.sendMessage({ chat_id: chatId, text: '🤖 APORTES-BOT en Telegram Serverless.\n🕐 ' + TIMEZONE });
      return;
    }
    if (command === '/cancel') {
      await api.sendMessage({ chat_id: chatId, text: '❌ Operación cancelada.' });
      return;
    }
    if (command === '/admin') {
      await api.sendMessage({ chat_id: chatId, text: '⚙️ El panel de administración se está migrando. No cambies aún el bot de producción.' });
      return;
    }
    const user = await ensureUser(message);
    if (!user) {
      await api.sendMessage({ chat_id: chatId, text: '🚫 No tienes acceso a este bot.' });
      return;
    }
    const forwarded = isForwarded(message);
    const method = forwarded ? 'forwardMessage' : 'copyMessage';
    await api[method]({
      chat_id: STORE_CHAT_ID, from_chat_id: chatId, message_id: message.message_id,
      message_thread_id: user.threadId,
    });
    user.conversationStartedAt = now();
    user.lastActivityAt = now();
    await saveUser(user);
    return;
  }

  if (chatId === Number(STORE_CHAT_ID) && message.message_thread_id) {
    const user = await findByThread(message.message_thread_id);
    if (!user || Number(message.message_id) === Number(user.registrationMessageId)) return;
    const forwarded = isForwarded(message);
    const method = forwarded ? 'forwardMessage' : 'copyMessage';
    try {
      await api[method]({ chat_id: user.userId, from_chat_id: chatId, message_id: message.message_id });
      user.lastActivityAt = now();
      await saveUser(user);
    } catch (error) {
      const msg = String(error?.description || error?.message || error).toLowerCase();
      if (msg.includes('blocked') || msg.includes('deactivated') || msg.includes('chat not found')) {
        user.blocked = true;
        await saveUser(user);
      } else {
        throw error;
      }
    }
  }
}
