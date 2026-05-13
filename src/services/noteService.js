
import { supabase } from '../supabaseClient';

const noteService = {
  async list() {
    const { data, error } = await supabase
      .from('notes').select('*, customers(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async listByCustomer(customerId) {
    const { data, error } = await supabase
      .from('notes').select('*').eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('notes').insert({ ...payload, user_id: user.id }).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('notes').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw error;
  },
};

export default noteService;