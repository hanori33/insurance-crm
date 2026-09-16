import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getToken } from 'firebase/messaging';
import { getFirebaseMessaging, VAPID_KEY } from '../firebase';
import { supabase } from '../supabaseClient';

const TEST_NOTIFICATION_ID = 900001;
const WEB_TEST_NOTIFICATION_TAG = 'boplan-web-test-notification';

function isNativeNotificationAvailable() {
  return Capacitor.isNativePlatform();
}

function normalizeNativePermission(status) {
  const display = status?.display;

  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  if (display === 'prompt' || display === 'prompt-with-rationale') return 'prompt';

  return 'unknown';
}

function normalizeWebPermission(permission) {
  if (permission === 'granted') return 'granted';
  if (permission === 'denied') return 'denied';
  if (permission === 'default') return 'prompt';
  return 'unsupported';
}

const notificationService = {
  TEST_NOTIFICATION_ID,
  WEB_TEST_NOTIFICATION_TAG,

  isNativeNotificationAvailable,

  async checkNotificationPermission() {
    if (isNativeNotificationAvailable()) {
      const status = await LocalNotifications.checkPermissions();
      return normalizeNativePermission(status);
    }

    if (!('Notification' in window)) return 'unsupported';
    return normalizeWebPermission(Notification.permission);
  },

  async requestNotificationPermission() {
    if (isNativeNotificationAvailable()) {
      const status = await LocalNotifications.requestPermissions();
      return normalizeNativePermission(status);
    }

    if (!('Notification' in window)) return 'unsupported';
    return normalizeWebPermission(await Notification.requestPermission());
  },

  async scheduleLocalNotification({
    id = TEST_NOTIFICATION_ID,
    title = '보플랜',
    body = '보플랜 휴대폰 알림 테스트입니다. 🔔',
    delayMinutes = 5,
    extra = { type: 'test' },
    tag = WEB_TEST_NOTIFICATION_TAG,
  } = {}) {
    // 알림 본문에는 주민등록번호, 계좌번호, 주소, 상세 병력, 진단명 등 민감정보를 넣지 않는다.
    if (isNativeNotificationAvailable()) {
      const permission = await this.checkNotificationPermission();
      if (permission !== 'granted') {
        throw new Error('알림 권한이 필요합니다.');
      }

      const at = new Date(Date.now() + delayMinutes * 60 * 1000);
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body,
            schedule: { at },
            extra,
          },
        ],
      });

      return { id, at, platform: 'native' };
    }

    const permission = await this.checkNotificationPermission();
    if (permission !== 'granted') {
      throw new Error('알림 권한이 필요합니다.');
    }

    const at = new Date(Date.now() + delayMinutes * 60 * 1000);
    window.setTimeout(() => {
      this.show(title, body, '/boplan192.png', {
        tag,
        renotify: true,
        requireInteraction: false,
      });
    }, delayMinutes * 60 * 1000);

    return { id, at, platform: 'web' };
  },

  async cancelLocalNotification(id = TEST_NOTIFICATION_ID) {
    if (!isNativeNotificationAvailable()) return;

    await LocalNotifications.cancel({
      notifications: [{ id }],
    });
  },

  async getPendingNotifications() {
    if (!isNativeNotificationAvailable()) return [];

    const pending = await LocalNotifications.getPending();
    return pending?.notifications || [];
  },

  async addActionListener(callback) {
    if (!isNativeNotificationAvailable()) return null;

    return LocalNotifications.addListener('localNotificationActionPerformed', callback);
  },

  async sendWebPushTestNotification() {
    if (isNativeNotificationAvailable()) {
      throw new Error('PC/Web 전용 테스트입니다.');
    }

    const permission = await this.checkNotificationPermission();
    if (permission !== 'granted') {
      throw new Error('알림 권한이 필요합니다.');
    }

    await this.ensureWebFcmToken();

    const { data, error } = await supabase.functions.invoke('boplan-fcm-test', {
      body: { type: 'test' },
    });

    if (error) {
      throw new Error(await this.getFunctionErrorMessage(error));
    }

    if (!data || Number(data.sent || 0) < 1) {
      throw new Error('전송 가능한 PC 푸시 토큰을 찾지 못했습니다.');
    }

    return data;
  },

  async ensureWebFcmToken() {
    if (isNativeNotificationAvailable()) return null;
    if (!('Notification' in window)) return null;

    if (Notification.permission !== 'granted') {
      throw new Error('알림 권한이 필요합니다.');
    }

    if (!('serviceWorker' in navigator)) {
      throw new Error('이 브라우저에서는 PC 푸시 알림을 사용할 수 없습니다.');
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.');
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      throw new Error('이 브라우저에서는 PC 푸시 알림을 사용할 수 없습니다.');
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      throw new Error('이 PC의 푸시 알림 토큰을 발급하지 못했습니다.');
    }

    await this.registerWebFcmToken(token);

    return token;
  },

  async registerWebFcmToken(token) {
    const { data, error } = await supabase.functions.invoke('boplan-register-fcm-token', {
      body: { token },
    });

    if (error) {
      const message = await this.getFunctionErrorMessage(error);
      throw new Error(message || 'PC 알림 기기 등록에 실패했습니다.');
    }

    if (!data?.registered) {
      throw new Error('PC 알림 기기 등록에 실패했습니다.');
    }

    return data;
  },

  async getFunctionErrorMessage(error) {
    const fallback = error?.message || 'PC 푸시 테스트 발송에 실패했습니다.';
    const response = error?.context;

    if (!response) return fallback;

    try {
      const payload = await response.clone().json();
      return payload?.error || payload?.message || fallback;
    } catch {
      return fallback;
    }
  },

  async requestPermission() {
    return this.requestNotificationPermission();
  },

  show(title, body, icon = '/boplan192.png', options = {}) {
    if (!('Notification' in window)) return null;
    if (Notification.permission === 'granted') {
      return new Notification(title, {
        body,
        icon,
        badge: icon,
        ...options,
      });
    }
    return null;
  },
};

export default notificationService;

// 기존 named export 호환
export const requestPermission = () => notificationService.requestPermission();
export const showNotification = (t, b, i) => notificationService.show(t, b, i);
export const checkNotificationPermission = () => notificationService.checkNotificationPermission();
export const requestNotificationPermission = () => notificationService.requestNotificationPermission();
export const scheduleLocalNotification = (payload) => notificationService.scheduleLocalNotification(payload);
export const cancelLocalNotification = (id) => notificationService.cancelLocalNotification(id);
export const getPendingNotifications = () => notificationService.getPendingNotifications();
export const sendWebPushTestNotification = () => notificationService.sendWebPushTestNotification();
