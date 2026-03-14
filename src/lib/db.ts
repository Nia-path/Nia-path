// src/lib/db.ts
// IndexedDB via idb for offline-first evidence and draft storage

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface NiaDB extends DBSchema {
  pending_uploads: {
    key: string;
    value: {
      id: string;
      case_id: string;
      file_name: string;
      file_data: ArrayBuffer;
      mime_type: string;
      captured_at: string;
      evidence_type: string;
      location_lat?: number;
      location_lng?: number;
      synced: boolean;
    };
  };
  draft_messages: {
    key: string;
    value: {
      id: string;
      content: string;
      timestamp: string;
    };
  };
  chat_history: {
    key: string;
    value: {
      id: string;
      session_id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: string;
    };
    indexes: { by_session: string };
  };
  pin_hash: {
    key: string;
    value: { key: string; hash: string; salt: string };
  };
}

let dbInstance: IDBPDatabase<NiaDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<NiaDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<NiaDB>("nia-path-db", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("pending_uploads")) {
        db.createObjectStore("pending_uploads", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("draft_messages")) {
        db.createObjectStore("draft_messages", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("chat_history")) {
        const store = db.createObjectStore("chat_history", { keyPath: "id" });
        store.createIndex("by_session", "session_id");
      }
      if (!db.objectStoreNames.contains("pin_hash")) {
        db.createObjectStore("pin_hash", { keyPath: "key" });
      }
    },
  });

  return dbInstance;
}

export async function savePendingUpload(item: NiaDB["pending_uploads"]["value"]) {
  const db = await getDB();
  await db.put("pending_uploads", item);
}

export async function getPendingUploads() {
  const db = await getDB();
  const all = await db.getAll("pending_uploads");
  return all.filter((i) => !i.synced);
}

export async function markUploadSynced(id: string) {
  const db = await getDB();
  const item = await db.get("pending_uploads", id);
  if (item) await db.put("pending_uploads", { ...item, synced: true });
}

export async function saveChatMessage(msg: NiaDB["chat_history"]["value"]) {
  const db = await getDB();
  await db.put("chat_history", msg);
}

export async function getChatHistory(sessionId: string) {
  const db = await getDB();
  return db.getAllFromIndex("chat_history", "by_session", sessionId);
}

export async function storePinHash(hash: string, salt: string) {
  const db = await getDB();
  await db.put("pin_hash", { key: "nia_pin", hash, salt });
}

export async function getPinHash(): Promise<{ hash: string; salt: string } | null> {
  const db = await getDB();
  const record = await db.get("pin_hash", "nia_pin");
  return record ? { hash: record.hash, salt: record.salt } : null;
}
