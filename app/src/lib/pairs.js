export const PAIR_NAMES = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'USD/CHF',
  'USD/CAD',
  'AUD/USD',
  'NZD/USD',
  'EUR/CHF',
  'EUR/CAD',
  'EUR/NZD',
  'GBP/CAD',
  'GBP/JPY',
  'NZD/CHF',
  'NZD/CAD',
]

// ['EUR', 'USD'] a partir de 'EUR/USD'.
export function monedasDe(par) {
  return par.split('/')
}
