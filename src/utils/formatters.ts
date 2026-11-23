const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(input: number | string): string {
  return String(input).replace(/\d/g, (digit) => BENGALI_DIGITS[Number(digit)] ?? digit);
}

export function formatBDT(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  const formatted = rounded.toLocaleString('en-US');
  return `৳ ${toBengaliDigits(formatted)}`;
}

export function getEffectivePrice(regularPrice: number, discountPrice: number | null): number {
  if (discountPrice !== null && discountPrice > 0 && discountPrice < regularPrice) {
    return discountPrice;
  }
  return regularPrice;
}

export function getDiscountPercentage(regularPrice: number, discountPrice: number | null): number {
  if (!discountPrice || discountPrice <= 0 || discountPrice >= regularPrice || regularPrice <= 0) {
    return 0;
  }
  return Math.round(((regularPrice - discountPrice) / regularPrice) * 100);
}

export function formatBengaliDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const formatted = date.toLocaleString('bn-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatted;
}
