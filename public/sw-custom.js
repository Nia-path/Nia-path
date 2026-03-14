// public/sw-custom.js
// Custom service worker extension for background sync

const SYNC_TAG = "nia-pending-uploads";
const CACHE_NAME = "nia-v1";

// Background sync handler
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncPendingUploads());
  }
});

async function syncPendingUploads() {
  try {
    const db = await openNiaDB();
    const tx = db.transaction("pending_uploads", "readonly");
    const store = tx.objectStore("pending_uploads");
    const items = await getAllFromStore(store);
    const pending = items.filter((item) => !item.synced);

    for (const item of pending) {
      try {
        const blob = new Blob([item.file_data], { type: item.mime_type });
        const file = new File([blob], item.file_name, { type: item.mime_type });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("case_id", item.case_id);
        formData.append("evidence_type", item.evidence_type);
        if (item.location_lat) formData.append("location_lat", String(item.location_lat));
        if (item.location_lng) formData.append("location_lng", String(item.location_lng));

        const res = await fetch("/api/evidence/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          // Mark as synced
          const writeTx = db.transaction("pending_uploads", "readwrite");
          const writeStore = writeTx.objectStore("pending_uploads");
          const record = await getFromStore(writeStore, item.id);
          if (record) {
            record.synced = true;
            await putToStore(writeStore, record);
          }
        }
      } catch (itemError) {
        console.error("[SW Sync] Failed to upload item:", item.id, itemError);
      }
    }
  } catch (error) {
    console.error("[SW Sync] Background sync failed:", error);
  }
}

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Nia Path", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Nia Path", {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: data.tag ?? "nia-notification",
      requireInteraction: data.urgent ?? false,
      data: { url: data.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── IndexedDB helpers ─────────────────────────────────────────────────────

function openNiaDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("nia-path-db", 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("pending_uploads")) {
        db.createObjectStore("pending_uploads", { keyPath: "id" });
      }
    };
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getFromStore(store, key) {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putToStore(store, value) {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
