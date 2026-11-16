// Small built-in gazetteer so customer locations can be placed on the dashboard globe without calling any outside service.
// A customer location is matched by city name first, then by country. Unmatched locations are listed as "not plotted".
export type Place = { name: string; lat: number; lng: number };

export const HUB: Place = { name: "Accra", lat: 5.6037, lng: -0.187 };

const CITIES: [string, number, number][] = [
  // Ghana
  ["accra", 5.6037, -0.187], ["tema", 5.6698, -0.0166], ["kumasi", 6.6885, -1.6244], ["takoradi", 4.8845, -1.7554], ["sekondi", 4.9344, -1.7138],
  ["tamale", 9.4075, -0.8534], ["cape coast", 5.1053, -1.2466], ["koforidua", 6.0941, -0.2591], ["ho", 6.6008, 0.4713], ["sunyani", 7.3349, -2.3123],
  ["wa", 10.0601, -2.5099], ["bolgatanga", 10.7856, -0.8514], ["techiman", 7.5833, -1.9333], ["obuasi", 6.2027, -1.6618], ["winneba", 5.3511, -0.6231],
  ["kasoa", 5.5339, -0.4167], ["madina", 5.6683, -0.1667], ["spintex", 5.6361, -0.0976], ["dodowa", 5.8833, -0.1167], ["nkawkaw", 6.5500, -0.7667],
  ["akim oda", 5.9300, -0.9900], ["hohoe", 7.1500, 0.4833], ["kintampo", 8.0560, -1.7300], ["navrongo", 10.8956, -1.0920], ["elmina", 5.0847, -1.3500],
  // Africa
  ["lagos", 6.5244, 3.3792], ["abuja", 9.0765, 7.3986], ["abidjan", 5.36, -4.0083], ["lome", 6.1319, 1.2228], ["cotonou", 6.3703, 2.3912],
  ["ouagadougou", 12.3714, -1.5197], ["dakar", 14.7167, -17.4677], ["nairobi", -1.2921, 36.8219], ["kampala", 0.3476, 32.5825], ["kigali", -1.9441, 30.0619],
  ["dar es salaam", -6.7924, 39.2083], ["addis ababa", 9.03, 38.74], ["johannesburg", -26.2041, 28.0473], ["cape town", -33.9249, 18.4241], ["cairo", 30.0444, 31.2357],
  ["casablanca", 33.5731, -7.5898], ["freetown", 8.4657, -13.2317], ["monrovia", 6.3, -10.7969], ["lusaka", -15.3875, 28.3228], ["harare", -17.8252, 31.0335],
  // Europe / Americas / Asia
  ["london", 51.5074, -0.1278], ["manchester", 53.4808, -2.2426], ["paris", 48.8566, 2.3522], ["berlin", 52.52, 13.405], ["amsterdam", 52.3676, 4.9041],
  ["madrid", 40.4168, -3.7038], ["rome", 41.9028, 12.4964], ["dublin", 53.3498, -6.2603], ["new york", 40.7128, -74.006], ["washington", 38.9072, -77.0369],
  ["chicago", 41.8781, -87.6298], ["los angeles", 34.0522, -118.2437], ["toronto", 43.6532, -79.3832], ["houston", 29.7604, -95.3698], ["sao paulo", -23.5505, -46.6333],
  ["dubai", 25.2048, 55.2708], ["doha", 25.2854, 51.531], ["riyadh", 24.7136, 46.6753], ["mumbai", 19.076, 72.8777], ["delhi", 28.6139, 77.209],
  ["singapore", 1.3521, 103.8198], ["beijing", 39.9042, 116.4074], ["shanghai", 31.2304, 121.4737], ["tokyo", 35.6762, 139.6503], ["sydney", -33.8688, 151.2093],
];

const COUNTRIES: [string, number, number][] = [
  ["ghana", 7.9465, -1.0232], ["nigeria", 9.082, 8.6753], ["ivory coast", 7.54, -5.5471], ["cote d'ivoire", 7.54, -5.5471], ["togo", 8.6195, 0.8248],
  ["benin", 9.3077, 2.3158], ["burkina faso", 12.2383, -1.5616], ["senegal", 14.4974, -14.4524], ["kenya", -0.0236, 37.9062], ["uganda", 1.3733, 32.2903],
  ["rwanda", -1.9403, 29.8739], ["tanzania", -6.369, 34.8888], ["ethiopia", 9.145, 40.4897], ["south africa", -30.5595, 22.9375], ["egypt", 26.8206, 30.8025],
  ["morocco", 31.7917, -7.0926], ["sierra leone", 8.4606, -11.7799], ["liberia", 6.4281, -9.4295], ["zambia", -13.1339, 27.8493], ["zimbabwe", -19.0154, 29.1549],
  ["uk", 55.3781, -3.436], ["united kingdom", 55.3781, -3.436], ["england", 52.3555, -1.1743], ["france", 46.2276, 2.2137], ["germany", 51.1657, 10.4515],
  ["netherlands", 52.1326, 5.2913], ["usa", 37.0902, -95.7129], ["united states", 37.0902, -95.7129], ["canada", 56.1304, -106.3468], ["uae", 23.4241, 53.8478],
  ["china", 35.8617, 104.1954], ["india", 20.5937, 78.9629], ["japan", 36.2048, 138.2529], ["australia", -25.2744, 133.7751],
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();

/** Finds coordinates for a free-text location like "Kumasi, Ghana". Returns null when it cannot be placed. */
export function geocode(location: string | null | undefined): Place | null {
  if (!location) return null;
  const s = ` ${norm(location)} `;
  // longest city name first so "cape coast" beats "ho"
  const city = [...CITIES].sort((a, b) => b[0].length - a[0].length).find(([n]) => s.includes(` ${n} `));
  if (city) return { name: city[0].replace(/\b\w/g, (c) => c.toUpperCase()), lat: city[1], lng: city[2] };
  const country = [...COUNTRIES].sort((a, b) => b[0].length - a[0].length).find(([n]) => s.includes(` ${n} `));
  if (country) return { name: country[0].replace(/\b\w/g, (c) => c.toUpperCase()), lat: country[1], lng: country[2] };
  return null;
}
