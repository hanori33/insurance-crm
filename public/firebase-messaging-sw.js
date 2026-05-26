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
  const title = payload.notification?.title || "보플랜";
  const options = {
    body: payload.notification?.body || "",
    icon: "/boplan192.png",
    badge: "/boplan192.png",
  };

  self.registration.showNotification(title, options);
});