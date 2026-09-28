import { supabase } from '../supabaseClient';

const VALID_CAR_EXPIRY_DAYS = new Set([7, 14, 30]);
const DEFAULT_CAR_EXPIRY = { enabled: true, days: 30 };

function readLocalCarExpirySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('notif_settings') || '{}');
    const candidate = saved?.carExpiry || {};
    return {
      enabled: typeof candidate.enabled === 'boolean'
        ? candidate.enabled
        : DEFAULT_CAR_EXPIRY.enabled,
      days: VALID_CAR_EXPIRY_DAYS.has(Number(candidate.days))
        ? Number(candidate.days)
        : DEFAULT_CAR_EXPIRY.days,
    };
  } catch {
    return { ...DEFAULT_CAR_EXPIRY };
  }
}

function syncLocalCarExpirySettings(settings) {
  try {
    const saved = JSON.parse(localStorage.getItem('notif_settings') || '{}');
    localStorage.setItem('notif_settings', JSON.stringify({
      ...saved,
      carExpiry: settings,
    }));
  } catch {
    localStorage.setItem('notif_settings', JSON.stringify({ carExpiry: settings }));
  }
}

function fromRow(row) {
  return {
    enabled: row.car_expiry_enabled !== false,
    days: VALID_CAR_EXPIRY_DAYS.has(Number(row.car_expiry_days))
      ? Number(row.car_expiry_days)
      : DEFAULT_CAR_EXPIRY.days,
  };
}

async function currentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.id) throw new Error('로그인이 필요합니다.');
  return user;
}

async function loadExisting(userId) {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('car_expiry_enabled,car_expiry_days')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

const notificationSettingsService = {
  async ensureCarExpirySettings() {
    const user = await currentUser();
    const existing = await loadExisting(user.id);

    if (existing) {
      const settings = fromRow(existing);
      syncLocalCarExpirySettings(settings);
      return settings;
    }

    const localSettings = readLocalCarExpirySettings();
    const { data, error } = await supabase
      .from('notification_settings')
      .insert({
        user_id: user.id,
        car_expiry_enabled: localSettings.enabled,
        car_expiry_days: localSettings.days,
        updated_at: new Date().toISOString(),
      })
      .select('car_expiry_enabled,car_expiry_days')
      .single();

    if (error?.code === '23505') {
      const racedRow = await loadExisting(user.id);
      if (!racedRow) throw error;
      const settings = fromRow(racedRow);
      syncLocalCarExpirySettings(settings);
      return settings;
    }
    if (error) throw error;

    const settings = fromRow(data);
    syncLocalCarExpirySettings(settings);
    return settings;
  },

  async updateCarExpirySettings(nextSettings) {
    const enabled = nextSettings?.enabled === true;
    const days = Number(nextSettings?.days);
    if (!VALID_CAR_EXPIRY_DAYS.has(days)) {
      throw new Error('자동차 만기 알림 시점을 확인해주세요.');
    }

    const user = await currentUser();
    const { data, error } = await supabase
      .from('notification_settings')
      .update({
        car_expiry_enabled: enabled,
        car_expiry_days: days,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('car_expiry_enabled,car_expiry_days')
      .single();

    if (error) throw error;

    const settings = fromRow(data);
    syncLocalCarExpirySettings(settings);
    return settings;
  },
};

export default notificationSettingsService;
