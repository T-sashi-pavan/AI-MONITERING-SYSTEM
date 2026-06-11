/**
 * Formats a UTC date string or Date object into Indian Standard Time (IST).
 * Returns 'Never' or 'N/A' for null/empty values.
 * 
 * @param {string|Date|number} dateVal 
 * @param {boolean} includeSeconds 
 * @returns {string} Formatted IST date-time string
 */
export function formatToIST(dateVal, includeSeconds = true) {
  if (!dateVal) return 'Never';
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) return dateVal;

  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined
  }) + ' IST';
}

/**
 * Formats a UTC date string or Date object into a short IST representation.
 * 
 * @param {string|Date|number} dateVal 
 * @returns {string} Formatted short IST string
 */
export function formatToISTShort(dateVal) {
  if (!dateVal) return 'N/A';
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) return dateVal;

  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' IST';
}

/**
 * Formats a date into just the date part in IST.
 * 
 * @param {string|Date|number} dateVal 
 * @returns {string} Formatted IST date
 */
export function formatToISTDateOnly(dateVal) {
  if (!dateVal) return 'Never';
  const date = new Date(dateVal);
  if (isNaN(date.getTime())) return dateVal;

  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
