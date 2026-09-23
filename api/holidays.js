const { parseStringPromise } = require('xml2js');

const HOLIDAY_API_URL =
  'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
const CACHE_CONTROL = 'public, s-maxage=21600, stale-while-revalidate=604800';

function cleanEnv(value) {
  return String(value || '').replace(/[\r\n\t]/g, '').trim();
}

function normalizeItems(items) {
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function normalizeDate(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(digits)) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: '허용되지 않은 요청입니다.' });
  }

  const year = Number(req.query?.year);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ error: '올바른 연도를 입력해주세요.' });
  }

  const serviceKey = cleanEnv(process.env.KASI_HOLIDAY_SERVICE_KEY);
  if (!serviceKey) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: '공휴일 정보 서비스를 사용할 수 없습니다.' });
  }

  try {
    const params = new URLSearchParams({
      ServiceKey: serviceKey,
      solYear: String(year),
      numOfRows: '100',
      pageNo: '1',
    });
    const response = await fetch(`${HOLIDAY_API_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error('HOLIDAY_UPSTREAM_HTTP_ERROR');

    const parsed = await parseStringPromise(await response.text(), {
      explicitArray: false,
      trim: true,
    });
    const apiResponse = parsed?.response;
    const resultCode = String(apiResponse?.header?.resultCode || '');
    if (resultCode !== '00') throw new Error('HOLIDAY_UPSTREAM_RESPONSE_ERROR');

    const holidays = normalizeItems(apiResponse?.body?.items?.item)
      .filter((item) => String(item?.isHoliday || '').toUpperCase() === 'Y')
      .map((item) => ({
        date: normalizeDate(item?.locdate),
        name: String(item?.dateName || '').trim(),
      }))
      .filter((item) => item.date && item.name)
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

    res.setHeader('Cache-Control', CACHE_CONTROL);
    return res.status(200).json({ holidays });
  } catch (_error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: '공휴일 정보를 불러오지 못했습니다.' });
  }
};
