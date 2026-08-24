import { supabase } from '../supabaseClient';

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeText(value) {
  return String(value || '').trim();
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error('로그인이 만료되었습니다. 다시 로그인 후 이용해주세요.');
  return data.user.id;
}

const coverageCriteriaService = {
  async getDefaultCriteriaSet() {
    const { data, error } = await supabase
      .from('coverage_analysis_criteria_sets')
      .select(`
        *,
        items:coverage_analysis_criteria_items (
          *,
          standard_coverage_categories (
            id,
            code,
            name,
            group_name,
            aggregation_mode,
            sort_order
          )
        )
      `)
      .eq('scope_type', 'user')
      .eq('is_default', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      items: [...(data.items || [])].sort((a, b) => {
        const orderA = Number(a.display_order ?? a.standard_coverage_categories?.sort_order ?? 1000);
        const orderB = Number(b.display_order ?? b.standard_coverage_categories?.sort_order ?? 1000);
        if (orderA !== orderB) return orderA - orderB;
        return String(a.standard_coverage_categories?.name || '').localeCompare(
          String(b.standard_coverage_categories?.name || ''),
          'ko',
        );
      }),
    };
  },

  async saveDefaultCriteriaSet({ id, name, items }) {
    const userId = await getCurrentUserId();
    let criteriaSetId = id;
    const setName = normalizeText(name) || '내 분석기준';

    if (criteriaSetId) {
      const { error } = await supabase
        .from('coverage_analysis_criteria_sets')
        .update({ name: setName, is_default: true })
        .eq('id', criteriaSetId)
        .eq('user_id', userId);

      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('coverage_analysis_criteria_sets')
        .insert({
          scope_type: 'user',
          user_id: userId,
          org_unit_id: null,
          name: setName,
          is_default: true,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      criteriaSetId = data.id;
    }

    const payload = (items || [])
      .filter((item) => item.standard_coverage_id)
      .map((item) => ({
        criteria_set_id: criteriaSetId,
        standard_coverage_id: item.standard_coverage_id,
        target_amount: toNumberOrNull(item.target_amount),
        is_enabled: Boolean(item.is_enabled),
        display_order: Number.isFinite(Number(item.display_order)) ? Number(item.display_order) : 1000,
        memo: normalizeText(item.memo) || null,
      }));

    if (payload.length > 0) {
      const { error } = await supabase
        .from('coverage_analysis_criteria_items')
        .upsert(payload, { onConflict: 'criteria_set_id,standard_coverage_id' });

      if (error) throw error;
    }

    return this.getDefaultCriteriaSet();
  },
};

export default coverageCriteriaService;
