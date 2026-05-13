
import { supabase } from '../supabaseClient';

const consultationService = {
  async listByCustomer(customerId) {
    const { data, error } = await supabase
      .from('consultations').select('*').eq('customer_id', customerId)
      .order('consulted_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('consultations').insert({ ...payload, user_id: user.id }).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('consultations').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from('consultations').delete().eq('id', id);
    if (error) throw error;
  },
};

export default consultationService;