// src/services/faxHistoryService.js
import { supabase } from '../supabaseClient';

const faxHistoryService = {
  async list() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
      .from('fax_history')
      .select('id,request_id,customer_id,customer_name,insurance_company,fax_number,files,status,provider_receipt_id,sent_at,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = data || [];
    const requestIds = rows.map((row) => row.request_id).filter(Boolean);
    if (requestIds.length === 0) return rows;

    const { data: transactions, error: transactionError } = await supabase
      .from('fax_credit_transactions')
      .select('request_id,status')
      .eq('user_id', user.id)
      .in('request_id', requestIds);
    if (transactionError) throw transactionError;

    const statusByRequest = new Map((transactions || []).map((row) => [row.request_id, row.status]));
    return rows.map((row) => ({
      ...row,
      credit_status: row.request_id ? statusByRequest.get(row.request_id) || null : null,
    }));
  },

  async remove(id) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('로그인이 필요합니다.');

    const { error } = await supabase
      .from('fax_history')
      .delete()
      .eq('id', id)
      .is('request_id', null)
      .eq('user_id', user.id);

    if (error) throw error;
  },
};

export default faxHistoryService;
