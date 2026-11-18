const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Phnom_Penh',
});
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Phnom_Penh',
});

export const formatRateDate = (value: string) =>
  dateFormat.format(new Date(`${value}T00:00:00+07:00`));
export const formatAuditTime = (value: string) => timeFormat.format(new Date(value));

// Keep the saved decimal precision instead of rounding through a JavaScript number.
export function formatRateValue(value: string) {
  const [whole, fraction] = value.split('.');
  const decimal = fraction?.replace(/0+$/, '');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${decimal ? `.${decimal}` : ''}`;
}
