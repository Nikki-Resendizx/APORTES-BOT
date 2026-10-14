import { db } from 'sdk';
import { eq } from 'sdk/db';
import { users, settings, bans } from '../schema.js';

export async function getUser(userId) {
  return await db.select().from(users).where(eq(users.userId, Number(userId))).get();
}

export async function saveUser(user) {
  const now = Math.floor(Date.now() / 1000);
  const value = {
    userId: Number(user.userId),
    threadId: user.threadId ?? null,
    registrationMessageId: user.registrationMessageId ?? null,
    registrationMessageType: user.registrationMessageType ?? null,
    profilePhotoFileId: user.profilePhotoFileId ?? null,
    blocked: Boolean(user.blocked),
    createdAt: Number(user.createdAt || now),
    lastActivityAt: user.lastActivityAt ?? now,
    conversationStartedAt: user.conversationStartedAt ?? null,
    profile: user.profile || {},
  };
  await db.insert(users).values(value)
    .onConflictDoUpdate({
      target: users.userId,
      set: {
        threadId: value.threadId,
        registrationMessageId: value.registrationMessageId,
        registrationMessageType: value.registrationMessageType,
        profilePhotoFileId: value.profilePhotoFileId,
        blocked: value.blocked,
        lastActivityAt: value.lastActivityAt,
        conversationStartedAt: value.conversationStartedAt,
        profile: value.profile,
      },
    }).run();
  return value;
}

export async function findByThread(threadId) {
  return await db.select().from(users).where(eq(users.threadId, Number(threadId))).get();
}

export async function getSetting(key, fallback = null) {
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const now = Math.floor(Date.now() / 1000);
  await db.insert(settings).values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: now },
    }).run();
  return value;
}

export async function isBanned(userId) {
  return Boolean(await db.select().from(bans).where(eq(bans.userId, Number(userId))).get());
}

export async function setBanned(userId, createdBy, reason = '') {
  await db.insert(bans).values({
    userId: Number(userId),
    createdAt: Math.floor(Date.now() / 1000),
    createdBy: Number(createdBy || 0),
    reason: String(reason || ''),
  }).onConflictDoUpdate({
    target: bans.userId,
    set: { createdAt: Math.floor(Date.now() / 1000), createdBy: Number(createdBy || 0), reason: String(reason || '') },
  }).run();
}

export async function setUnbanned(userId) {
  await db.delete(bans).where(eq(bans.userId, Number(userId))).run();
}
