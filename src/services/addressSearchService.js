import { supabase } from '../supabaseClient';

async function getAddressSearchErrorMessage(error) {
  const status = error?.context?.status;

  if (status === 401) {
    return '로그인이 만료되었습니다. 다시 로그인 후 이용해주세요.';
  }

  if (error?.context) {
    try {
      const payload = await error.context.clone().json();
      if (payload?.error) return payload.error;
      if (payload?.message) return payload.message;
    } catch {
      // Fall through to the generic message.
    }
  }

  return '주소 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}

export async function searchRoadAddresses(keyword) {
  const normalizedKeyword = String(keyword || '').trim();

  if (normalizedKeyword.length < 2) {
    return [];
  }

  const { data, error } = await supabase.functions.invoke('juso-address-search', {
    body: {
      keyword: normalizedKeyword,
    },
  });

  if (error) {
    throw new Error(await getAddressSearchErrorMessage(error));
  }

  return Array.isArray(data?.results) ? data.results : [];
}

export default {
  searchRoadAddresses,
};
