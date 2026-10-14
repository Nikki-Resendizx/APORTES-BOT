import { table, integer, text, boolean, json, index } from 'sdk/db';

// The Serverless database is persistent across invocations. No filesystem is
// available at runtime, so state formerly stored in data/state.json lives here.
export const users = table('users', {
  userId: integer('user_id').primaryKey(),
  threadId: integer('thread_id').unique(),
  registrationMessageId: integer('registration_message_id'),
  registrationMessageType: text('registration_message_type'),
  profilePhotoFileId: text('profile_photo_file_id'),
  blocked: boolean('blocked').default(false),
  createdAt: integer('created_at').notNull(),
  lastActivityAt: integer('last_activity_at'),
  conversationStartedAt: integer('conversation_started_at'),
  profile: json('profile').notNull(),
}, (t) => ({
  threadIdx: index('idx_users_thread_id').on(t.threadId),
}));

export const settings = table('settings', {
  key: text('key').primaryKey(),
  value: json('value'),
  updatedAt: integer('updated_at').notNull(),
});

export const bans = table('bans', {
  userId: integer('user_id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  createdBy: integer('created_by'),
  reason: text('reason'),
});

export const albumItems = table('album_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  queueKey: text('queue_key').notNull(),
  userId: integer('user_id').notNull(),
  sourceChatId: integer('source_chat_id').notNull(),
  messageId: integer('message_id').notNull(),
  forwarded: boolean('forwarded').default(false),
  direction: text('direction').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => ({
  queueIdx: index('idx_album_queue_key').on(t.queueKey),
}));
