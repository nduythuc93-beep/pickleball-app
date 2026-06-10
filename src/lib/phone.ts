/**
 * Vietnamese mobile phone validation.
 * Format: exactly 10 digits starting with 0 (after stripping spaces/dashes/dots).
 */

/** Strip whitespace, dashes, dots, parentheses */
export function normalizePhone(input: string): string {
  return input.replace(/[\s.\-()]/g, '')
}

/** True if string is a valid 10-digit VN mobile number */
export function isValidVnPhone(input: string): boolean {
  const clean = normalizePhone(input)
  return /^0\d{9}$/.test(clean)
}

/** User-facing error message when phone is invalid */
export const PHONE_INVALID_MSG =
  'Số điện thoại không hợp lệ — phải đủ 10 số bắt đầu bằng 0'
