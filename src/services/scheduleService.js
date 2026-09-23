// src/services/scheduleService.js
import { supabase } from '../supabaseClient';
import { kstDateRangeToUtcIso, todayStr } from '../utils';

const scheduleService = {
  async listByDate(dateStr) {
    const { start, endExclusive } = kstDateRangeToUtcIso(dateStr);
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .gte('scheduled_at', start)
      .lt('scheduled_at', endExclusive)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getMonthSchedules(startDate, endDate) {
    const { start, endExclusive } = kstDateRangeToUtcIso(startDate, endDate);
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .gte('scheduled_at', start)
      .lt('scheduled_at', endExclusive)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return { data: data || [] };
  },

  async today() {
    return scheduleService.listByDate(todayStr());
  },

  async listByCustomer(customerName) {
    if (!customerName) return [];

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('customer_name', customerName)
      .order('scheduled_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) throw authError;
    if (!authData?.user) throw new Error('로그인이 필요합니다.');

    const cleanPayload = {
      title: payload.title || '',
      customer_name: payload.customer_name || null,
      scheduled_at: payload.scheduled_at,
      schedule_type: payload.schedule_type || 'etc',
      schedule_icon: payload.schedule_icon || '🔔',
      memo: payload.memo || null,
      next_action: payload.next_action || null,
      reminder_minutes: payload.reminder_minutes ?? null,
      color: payload.color || '#E5D4FF',
      completed: payload.completed ?? false,
      user_id: authData.user.id,
    };

    const { data, error } = await supabase
      .from('schedules')
      .insert(cleanPayload)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const cleanPayload = {
      title: payload.title || '',
      customer_name: payload.customer_name || null,
      scheduled_at: payload.scheduled_at,
      schedule_type: payload.schedule_type || 'etc',
      schedule_icon: payload.schedule_icon || '🔔',
      memo: payload.memo || null,
      next_action: payload.next_action || null,
      reminder_minutes: payload.reminder_minutes ?? null,
      color: payload.color || '#E5D4FF',
    };

    const { data, error } = await supabase
      .from('schedules')
      .update(cleanPayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async complete(id) {
    const { data, error } = await supabase
      .from('schedules')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async reopen(id) {
    const { data, error } = await supabase
      .from('schedules')
      .update({
        completed: false,
        completed_at: null,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

export default scheduleService;

export const getSchedules = (date) => scheduleService.listByDate(date);

export const getMonthSchedules = (startDate, endDate) =>
  scheduleService.getMonthSchedules(startDate, endDate);

export const addSchedule = (payload) => scheduleService.create(payload);

export const updateSchedule = (id, payload) =>
  scheduleService.update(id, payload);

export const deleteSchedule = (id) => scheduleService.remove(id);

export const getTodaySchedules = () => scheduleService.today();

export const getCustomerSchedules = (customerName) =>
  scheduleService.listByCustomer(customerName);

export const completeSchedule = (id) => scheduleService.complete(id);

export const reopenSchedule = (id) => scheduleService.reopen(id);
