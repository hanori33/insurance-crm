import { supabase } from '../supabaseClient';

const VALID_CAR_EXPIRY_DAYS = new Set([7, 14, 30]);
const DEFAULT_CAR_EXPIRY = { enabled: true, days: 30 };
const DEFAULT_INSURANCE_EXPIRY = { enabled: true, days: 30 };

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

function readLocalInsuranceExpirySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('notif_settings') || '{}');
    const candidate = saved?.saleExpiry || {};
    return {
      enabled: typeof candidate.enabled === 'boolean'
        ? candidate.enabled
        : DEFAULT_INSURANCE_EXPIRY.enabled,
      days: VALID_CAR_EXPIRY_DAYS.has(Number(candidate.days))
        ? Number(candidate.days)
        : DEFAULT_INSURANCE_EXPIRY.days,
    };
  } catch {
    return { ...DEFAULT_INSURANCE_EXPIRY };
  }
}

function syncLocalInsuranceExpirySettings(settings) {
  try {
    const saved = JSON.parse(localStorage.getItem('notif_settings') || '{}');
    localStorage.setItem('notif_settings', JSON.stringify({
      ...saved,
      saleExpiry: settings,
    }));
  } catch {
    localStorage.setItem('notif_settings', JSON.stringify({ saleExpiry: settings }));
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

async function loadInsuranceExisting(userId) {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('insurance_expiry_enabled,insurance_expiry_days,insurance_expiry_initialized')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function insuranceFromRow(row) {
  return {
    enabled: row.insurance_expiry_enabled !== false,
    days: VALID_CAR_EXPIRY_DAYS.has(Number(row.insurance_expiry_days))
      ? Number(row.insurance_expiry_days)
      : DEFAULT_INSURANCE_EXPIRY.days,
  };
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

  async ensureInsuranceExpirySettings() {
    await notificationSettingsService.ensureCarExpirySettings();
    const user = await currentUser();
    const existing = await loadInsuranceExisting(user.id);

    if (existing?.insurance_expiry_initialized) {
      const settings = insuranceFromRow(existing);
      syncLocalInsuranceExpirySettings(settings);
      return settings;
    }

    const localSettings = readLocalInsuranceExpirySettings();
    const payload = {
      user_id: user.id,
      insurance_expiry_enabled: localSettings.enabled,
      insurance_expiry_days: localSettings.days,
      insurance_expiry_initialized: true,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('notification_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select('insurance_expiry_enabled,insurance_expiry_days,insurance_expiry_initialized')
      .single();
    if (error) throw error;

    const settings = insuranceFromRow(data);
    syncLocalInsuranceExpirySettings(settings);
    return settings;
  },

  async updateInsuranceExpirySettings(nextSettings) {
    const enabled = nextSettings?.enabled === true;
    const days = Number(nextSettings?.days);
    if (!VALID_CAR_EXPIRY_DAYS.has(days)) {
      throw new Error('보험 만기 알림 시점을 확인해주세요.');
    }

    const user = await currentUser();
    const { data, error } = await supabase
      .from('notification_settings')
      .update({
        insurance_expiry_enabled: enabled,
        insurance_expiry_days: days,
        insurance_expiry_initialized: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('insurance_expiry_enabled,insurance_expiry_days')
      .single();
    if (error) throw error;

    const settings = insuranceFromRow(data);
    syncLocalInsuranceExpirySettings(settings);
    return settings;
  },
};

export default notificationSettingsService;
