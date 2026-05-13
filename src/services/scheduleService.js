import { supabase } from '../supabaseClient';

const scheduleService = {
  async listByDate(dateStr) {
    const { data, error } = await supabase
      .from('schedules')
      .select('*, customers(name)')
      .gte('scheduled_at', `${dateStr}T00:00:00`)
      .lte('scheduled_at', `${dateStr}T23:59:59`)
      .order('scheduled_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async today() {
    const d = new Date();
    const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return scheduleService.listByDate(s);
  },

  async create(payload) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('schedules').insert({ ...payload, user_id: user.id }).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('schedules').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) throw error;
  },
};

export default scheduleService;

// ── 기존 named export 호환 ──────────────────────
export const getSchedules    = (date) => scheduleService.listByDate(date);
export const addSchedule     = (p)    => scheduleService.create(p);
export const updateSchedule  = (id,p) => scheduleService.update(id, p);
export const deleteSchedule  = (id)   => scheduleService.remove(id);
export const getTodaySchedules = ()   => scheduleService.today();
