const yearCache = new Map();
const pendingRequests = new Map();

function normalizeHolidays(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((holiday) => ({
      date: String(holiday?.date || ''),
      name: String(holiday?.name || '').trim(),
    }))
    .filter((holiday) => /^\d{4}-\d{2}-\d{2}$/.test(holiday.date) && holiday.name);
}

async function fetchByYear(year) {
  const normalizedYear = Number(year);
  if (!Number.isInteger(normalizedYear)) return [];
  if (yearCache.has(normalizedYear)) return yearCache.get(normalizedYear);
  if (pendingRequests.has(normalizedYear)) return pendingRequests.get(normalizedYear);

  const request = fetch(`/api/holidays?year=${normalizedYear}`)
    .then(async (response) => {
      if (!response.ok) return [];
      const payload = await response.json();
      return normalizeHolidays(payload?.holidays);
    })
    .catch(() => [])
    .then((holidays) => {
      yearCache.set(normalizedYear, holidays);
      pendingRequests.delete(normalizedYear);
      return holidays;
    });

  pendingRequests.set(normalizedYear, request);
  return request;
}

const holidayService = { fetchByYear };

export default holidayService;
