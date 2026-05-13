import { supabase } from '../supabaseClient';

const salesService = {
  async monthlySales(months = 5) {
    const from = new Date();
    from.setMonth(from.getMonth() - months + 1); from.setDate(1);
    const { data, error } = await supabase
      .from('sales').select('amount,sale_date')
      .gte('sale_date', from.toISOString().slice(0, 10))
      .order('sale_date', { ascending: true });
    if (error) throw error;
    const map = {};
    (data || []).forEach(r => {
      const k = r.sale_date?.slice(0, 7);
      if (k) map[k] = (map[k] || 0) + Number(r.amount);
    });
    return map;
  },

  async thisMonth() {
    const n = new Date();
    const ym = `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
    const { data, error } = await supabase
      .from('sales').select('amount')
      .gte('sale_date', `${ym}-01`).lte('sale_date', `${ym}-31`);
    if (error) throw error;
    return (data || []).reduce((s, r) => s + Number(r.amount), 0);
  },
};

export default salesService;

// ── 기존 named export 호환 ──────────────────────
export const getMonthlySales = (m) => salesService.monthlySales(m);
export const getThisMonthSales = () => salesService.thisMonth();
