const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function underThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
  const rest = n % 100;
  if (rest) {
    const words = rest < 20 ? ONES[rest]! : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ''}`;
    parts.push(n >= 100 ? `and ${words}` : words);
  }
  return parts.join(' ');
}

/** 1250 -> "One Thousand Two Hundred and Fifty". Whole numbers below a trillion. */
export function numberToWords(n: number): string {
  const whole = Math.floor(Math.abs(n));
  if (whole === 0) return 'Zero';
  const scales: [number, string][] = [
    [1_000_000_000, 'Billion'],
    [1_000_000, 'Million'],
    [1_000, 'Thousand'],
  ];
  const parts: string[] = [];
  let rest = whole;
  for (const [size, name] of scales) {
    if (rest >= size) {
      parts.push(`${underThousand(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest) parts.push(rest < 100 && parts.length ? `and ${underThousand(rest)}` : underThousand(rest));
  return parts.join(' ');
}

/** As on Noorcom's invoices: "Kenya Shillings Ninety Thousand Only." */
export function shillingsInWords(amount: number): string {
  return `Kenya Shillings ${numberToWords(Math.round(amount))} Only.`;
}
