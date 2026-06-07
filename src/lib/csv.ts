/**
 * Convert array of objects to CSV string.
 * Headers tự lấy từ keys của object đầu tiên (hoặc tự define).
 */
export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  headers?: Array<{ key: keyof T | string; label: string }>
): string {
  if (rows.length === 0) return ''

  const cols = headers ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }))

  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const headerLine = cols.map((c) => escape(c.label)).join(',')
  const lines = rows.map((r) =>
    cols.map((c) => escape((r as Record<string, unknown>)[c.key as string])).join(',')
  )
  return [headerLine, ...lines].join('\n')
}

/** Trigger download CSV file ở client */
export function downloadCSV(filename: string, csv: string) {
  // BOM cho Excel mở tiếng Việt đúng
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
