const notificationService = {
  async requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    return await Notification.requestPermission();
  },
  show(title, body, icon = '/logo192.png') {
    if (Notification.permission === 'granted') {
      return new Notification(title, { body, icon });
    }
  },
};

export default notificationService;

// ── 기존 named export 호환 ──────────────────────
export const requestPermission = () => notificationService.requestPermission();
export const showNotification  = (t,b,i) => notificationService.show(t, b, i);
