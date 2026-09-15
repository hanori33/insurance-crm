importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC49l_13Px1MZiFA9AcRS16KCsBhN22Ve4",
  authDomain: "insu-real.firebaseapp.com",
  projectId: "insu-real",
  storageBucket: "insu-real.firebasestorage.app",
  messagingSenderId: "45430693118",
  appId: "1:45430693118:web:fc11ff4fe8274b6bd9d9af",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const data = payload.data || {};
  const title = payload.notification?.title || data.title || "보플랜";
  const options = {
    body: payload.notification?.body || data.body || "",
    icon: "/boplan192.png",
    badge: "/boplan192.png",
    tag: data.tag || data.notificationId || data.scheduleId || data.type || "boplan-fcm",
    data: {
      ...data,
      url: data.url || "/",
    },
    requireInteraction: data.requireInteraction === "true",
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client && client.url !== targetUrl) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
