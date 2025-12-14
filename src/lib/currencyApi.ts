export interface ExchangeRates {
  [currency: string]: number;
}

export interface CachedRates {
  rates: ExchangeRates;
  timestamp: number;
  baseCurrency: string;
}

const CACHE_KEY = 'currency_rates_cache';
const CACHE_DURATION = 6 * 60 * 60 * 1000;
const API_BASE_URL = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1';

export async function fetchExchangeRates(baseCurrency: string = 'usd'): Promise<ExchangeRates> {
  try {
    const cachedData = getCachedRates();

    if (cachedData && cachedData.baseCurrency === baseCurrency) {
      const age = Date.now() - cachedData.timestamp;
      if (age < CACHE_DURATION) {
        return cachedData.rates;
      }
    }

    const response = await fetch(`${API_BASE_URL}/currencies/${baseCurrency}.json`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const rates = data[baseCurrency] as ExchangeRates;

    if (!rates) {
      throw new Error('Invalid API response format');
    }

    cacheRates(rates, baseCurrency);
    return rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);

    const cachedData = getCachedRates();
    if (cachedData && cachedData.baseCurrency === baseCurrency) {
      return cachedData.rates;
    }

    throw new Error('Unable to fetch exchange rates and no cache available');
  }
}

function getCachedRates(): CachedRates | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached) as CachedRates;
    return data;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
}

function cacheRates(rates: ExchangeRates, baseCurrency: string): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheData: CachedRates = {
      rates,
      timestamp: Date.now(),
      baseCurrency
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error writing to cache:', error);
  }
}

export function getLastUpdated(): Date | null {
  const cached = getCachedRates();
  if (!cached) return null;
  return new Date(cached.timestamp);
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRates
): number {
  const from = fromCurrency.toLowerCase();
  const to = toCurrency.toLowerCase();

  if (from === to) return amount;

  if (from === 'usd') {
    const rate = rates[to];
    if (!rate) throw new Error(`Rate not found for ${to}`);
    return amount * rate;
  }

  if (to === 'usd') {
    const rate = rates[from];
    if (!rate) throw new Error(`Rate not found for ${from}`);
    return amount / rate;
  }

  const fromRate = rates[from];
  const toRate = rates[to];

  if (!fromRate || !toRate) {
    throw new Error(`Rates not found for conversion`);
  }

  const amountInUSD = amount / fromRate;
  return amountInUSD * toRate;
}

export function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRates
): number {
  return convertCurrency(1, fromCurrency, toCurrency, rates);
}

export function formatCurrencyAmount(amount: number, currencyCode: string): string {
  const decimals = amount < 1 && amount > 0 ? 4 : 2;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}
