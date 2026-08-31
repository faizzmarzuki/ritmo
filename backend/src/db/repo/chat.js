import { all, one, run } from '../index.js'
import { randomId } from '../../lib/crypto.js'

// ── conversations ────────────────────────────────────────────────────────────
export function createConversation(userId, title) {
  const id = randomId()
  run('INSERT INTO chat_conversations (id, user_id, title) VALUES (?, ?, ?)', id, userId, title)
  return id
}

export const getConversation = (userId, id) =>
  one('SELECT * FROM chat_conversations WHERE user_id = ? AND id = ?', userId, id)

/** Newest first, with a snippet of the last message for the history list. */
export const listConversations = (userId, limit = 50) =>
  all(
    `SELECT c.id, c.title, c.created_at, c.updated_at,
            (SELECT content FROM chat_messages m
              WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id) AS message_count
     FROM chat_conversations c
     WHERE c.user_id = ?
     ORDER BY c.updated_at DESC
     LIMIT ?`,
    userId, limit,
  )

export const deleteConversation = (userId, id) =>
  run('DELETE FROM chat_conversations WHERE user_id = ? AND id = ?', userId, id)

export const touchConversation = (id) =>
  run("UPDATE chat_conversations SET updated_at = datetime('now') WHERE id = ?", id)

// ── messages ─────────────────────────────────────────────────────────────────
export function addChatMessage(userId, conversationId, role, content, meta = null) {
  const id = randomId()
  run(
    'INSERT INTO chat_messages (id, conversation_id, user_id, role, content, meta) VALUES (?, ?, ?, ?, ?, ?)',
    id, conversationId, userId, role, content, meta ? JSON.stringify(meta) : null,
  )
  touchConversation(conversationId)
  return id
}

/** Full thread, oldest first. rowid breaks ties for messages saved in the same second. */
export const listChatMessages = (conversationId) =>
  all('SELECT id, role, content, meta, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY created_at, rowid', conversationId)

/** Last N turns of one thread for the model context, oldest first. */
export const recentThread = (conversationId, limit = 8) =>
  all(
    `SELECT role, content FROM (
       SELECT role, content, created_at, rowid FROM chat_messages
       WHERE conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?
     ) ORDER BY created_at, rowid`,
    conversationId, limit,
  )

/** Recent messages from OTHER conversations — the pool the recall step scores. */
export const recentMessagesAcross = (userId, excludeConversationId, limit = 400) =>
  all(
    `SELECT m.role, m.content, m.created_at, c.title
     FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id
     WHERE m.user_id = ? AND m.conversation_id <> ?
     ORDER BY m.created_at DESC LIMIT ?`,
    userId, excludeConversationId ?? '', limit,
  )
