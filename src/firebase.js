// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyC49l_13Px1MZiFA9AcRS16KCsBhN22Ve4',
  authDomain: 'insu-real.firebaseapp.com',
  projectId: 'insu-real',
  storageBucket: 'insu-real.firebasestorage.app',
  messagingSenderId: '45430693118',
  appId: '1:45430693118:web:fc11ff4fe8274b6bd9d9af',
  measurementId: 'G-QJ3VMEE52W',
};

const app = initializeApp(firebaseConfig);

export const VAPID_KEY =
  'BDRSxNHUUlG0riLg2MyVehFpovckn7WswWowZmS1ZWIak9LkO-9XFyIgXNbhY2rfB3fca570XyMgethfj9Zv-kI';

export const getFirebaseMessaging = async () => {
  const supported = await isSupported();

  if (!supported) return null;

  return getMessaging(app);
};

export default app;