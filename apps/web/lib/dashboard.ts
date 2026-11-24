export type DashboardData = {
  summary: { companyCount: number; totalRevenue: string; countryCount: number; totalEmployees: string; revenueReported: number; employeesReported: number };
  levels: { level: string; count: number; percentage: number }[];
  growth: { year: number; added: number; cumulative: number }[];
  coverage: { yearKnown: number; yearExcluded: number; yearMissing: number; yearInvalid: number };
  generatedAt: string; asOfYear: number;
};
const units = [{ value: 10n**16n, label: '京' }, { value: 10n**12n, label: '万亿' }, { value: 10n**8n, label: '亿' }, { value: 10n**4n, label: '万' }, { value: 1n, label: '' }];
// Decimal arithmetic uses BigInt, including rounding at unit boundaries, rather
// than converting large PostgreSQL numeric strings into imprecise JS numbers.
export function compactNumber(input: string | number | bigint) {
  const raw = String(input);
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error('Expected a non-negative decimal value');
  const [whole, fraction = ''] = raw.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole + fraction);
  let index = units.findIndex(unit => numerator >= unit.value * scale);
  if (index < 0) index = units.length - 1;
  let divisor = units[index].value * scale;
  let hundredths = (numerator * 100n + divisor / 2n) / divisor;
  // 9999.999 becomes 1 万, rather than displaying 10,000 without a unit.
  if (index > 0 && hundredths >= (units[index-1].value / units[index].value) * 100n) {
    index--; divisor = units[index].value * scale;
    hundredths = (numerator * 100n + divisor / 2n) / divisor;
  }
  const decimals = String(hundredths % 100n).padStart(2, '0').replace(/0+$/, '');
  const text = new Intl.NumberFormat('zh-CN').format(hundredths / 100n) + (decimals ? '.' + decimals : '');
  const exact = new Intl.NumberFormat('zh-CN').format(BigInt(whole)) + (fraction.replace(/0+$/, '') ? '.' + fraction.replace(/0+$/, '') : '');
  return { text, unit: units[index].label, exact };
}
export const levelColor = (index: number) => ['#28755b','#73ae88','#d1b16b','#6f9fa2','#9a90b5','#b68b75'][index] || `hsl(${(index * 137.508) % 360}, 38%, 54%)`;
