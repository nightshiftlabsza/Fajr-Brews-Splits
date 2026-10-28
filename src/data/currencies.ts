export interface Currency {
  code: string;
  name: string;
  symbol: string;
  countries: string[];
}

export const SUGGESTED_CURRENCY_CODES = ['EUR', 'GBP', 'USD', 'ZAR'] as const;

export const CURRENCIES: Currency[] = [
  { code: 'EUR', name: 'Euro', symbol: '€', countries: ['Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Portugal', 'Ireland', 'Finland', 'Greece'] },
  { code: 'GBP', name: 'Pound sterling', symbol: '£', countries: ['United Kingdom', 'Great Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland'] },
  { code: 'USD', name: 'US dollar', symbol: '$', countries: ['United States', 'USA', 'America'] },
  { code: 'ZAR', name: 'South African rand', symbol: 'R', countries: ['South Africa'] },
  { code: 'AED', name: 'United Arab Emirates dirham', symbol: 'د.إ', countries: ['United Arab Emirates', 'UAE', 'Dubai', 'Abu Dhabi'] },
  { code: 'ARS', name: 'Argentine peso', symbol: '$', countries: ['Argentina'] },
  { code: 'AUD', name: 'Australian dollar', symbol: 'A$', countries: ['Australia'] },
  { code: 'BRL', name: 'Brazilian real', symbol: 'R$', countries: ['Brazil'] },
  { code: 'CAD', name: 'Canadian dollar', symbol: 'CA$', countries: ['Canada'] },
  { code: 'CHF', name: 'Swiss franc', symbol: 'CHF', countries: ['Switzerland', 'Liechtenstein'] },
  { code: 'CLP', name: 'Chilean peso', symbol: '$', countries: ['Chile'] },
  { code: 'CNY', name: 'Chinese yuan', symbol: '¥', countries: ['China'] },
  { code: 'COP', name: 'Colombian peso', symbol: '$', countries: ['Colombia'] },
  { code: 'CZK', name: 'Czech koruna', symbol: 'Kč', countries: ['Czech Republic', 'Czechia'] },
  { code: 'DKK', name: 'Danish krone', symbol: 'kr', countries: ['Denmark', 'Greenland'] },
  { code: 'EGP', name: 'Egyptian pound', symbol: 'E£', countries: ['Egypt'] },
  { code: 'ETB', name: 'Ethiopian birr', symbol: 'Br', countries: ['Ethiopia'] },
  { code: 'GHS', name: 'Ghanaian cedi', symbol: 'GH₵', countries: ['Ghana'] },
  { code: 'HKD', name: 'Hong Kong dollar', symbol: 'HK$', countries: ['Hong Kong'] },
  { code: 'HUF', name: 'Hungarian forint', symbol: 'Ft', countries: ['Hungary'] },
  { code: 'IDR', name: 'Indonesian rupiah', symbol: 'Rp', countries: ['Indonesia'] },
  { code: 'ILS', name: 'Israeli new shekel', symbol: '₪', countries: ['Israel'] },
  { code: 'INR', name: 'Indian rupee', symbol: '₹', countries: ['India'] },
  { code: 'ISK', name: 'Icelandic króna', symbol: 'kr', countries: ['Iceland'] },
  { code: 'JPY', name: 'Japanese yen', symbol: '¥', countries: ['Japan'] },
  { code: 'KES', name: 'Kenyan shilling', symbol: 'KSh', countries: ['Kenya'] },
  { code: 'KRW', name: 'South Korean won', symbol: '₩', countries: ['South Korea', 'Korea'] },
  { code: 'KWD', name: 'Kuwaiti dinar', symbol: 'د.ك', countries: ['Kuwait'] },
  { code: 'MXN', name: 'Mexican peso', symbol: '$', countries: ['Mexico'] },
  { code: 'MYR', name: 'Malaysian ringgit', symbol: 'RM', countries: ['Malaysia'] },
  { code: 'NGN', name: 'Nigerian naira', symbol: '₦', countries: ['Nigeria'] },
  { code: 'NOK', name: 'Norwegian krone', symbol: 'kr', countries: ['Norway'] },
  { code: 'NZD', name: 'New Zealand dollar', symbol: 'NZ$', countries: ['New Zealand'] },
  { code: 'PEN', name: 'Peruvian sol', symbol: 'S/.', countries: ['Peru'] },
  { code: 'PHP', name: 'Philippine peso', symbol: '₱', countries: ['Philippines'] },
  { code: 'PLN', name: 'Polish złoty', symbol: 'zł', countries: ['Poland'] },
  { code: 'QAR', name: 'Qatari riyal', symbol: '﷼', countries: ['Qatar'] },
  { code: 'RON', name: 'Romanian leu', symbol: 'lei', countries: ['Romania'] },
  { code: 'RWF', name: 'Rwandan franc', symbol: 'FRw', countries: ['Rwanda'] },
  { code: 'SAR', name: 'Saudi riyal', symbol: '﷼', countries: ['Saudi Arabia'] },
  { code: 'SEK', name: 'Swedish krona', symbol: 'kr', countries: ['Sweden'] },
  { code: 'SGD', name: 'Singapore dollar', symbol: 'S$', countries: ['Singapore'] },
  { code: 'THB', name: 'Thai baht', symbol: '฿', countries: ['Thailand'] },
  { code: 'TRY', name: 'Turkish lira', symbol: '₺', countries: ['Turkey', 'Türkiye'] },
  { code: 'TWD', name: 'New Taiwan dollar', symbol: 'NT$', countries: ['Taiwan'] },
  { code: 'TZS', name: 'Tanzanian shilling', symbol: 'TSh', countries: ['Tanzania'] },
  { code: 'UGX', name: 'Ugandan shilling', symbol: 'USh', countries: ['Uganda'] },
  { code: 'VND', name: 'Vietnamese đồng', symbol: '₫', countries: ['Vietnam'] },
];

const CURRENCY_BY_CODE = new Map<string, Currency>(
  CURRENCIES.map((c) => [c.code.toUpperCase(), c])
);

export function getCurrency(code: string | null | undefined): Currency | undefined {
  if (!code) return undefined;
  return CURRENCY_BY_CODE.get(code.toUpperCase().trim());
}

export function getAllCurrencies(): Currency[] {
  return [...CURRENCIES].sort((a, b) => a.name.localeCompare(b.name));
}

export function getSuggestedCurrencies(): Currency[] {
  return SUGGESTED_CURRENCY_CODES.map((code) => CURRENCY_BY_CODE.get(code)!).filter(Boolean);
}

export function isSuggestedCurrency(currency: Currency): boolean {
  return (SUGGESTED_CURRENCY_CODES as readonly string[]).includes(currency.code);
}
