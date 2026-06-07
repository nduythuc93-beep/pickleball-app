import type { FieldSchema } from '../types/database'

export type TemplateKey = 'jersey' | 'tournament' | 'attendance' | 'custom'

export const SURVEY_TEMPLATES: Record<
  Exclude<TemplateKey, 'custom'>,
  { label: string; description: string; defaultTitle: string; fields: FieldSchema[] }
> = {
  jersey: {
    label: 'Đặt áo',
    description: 'Đăng ký size áo + số lượng + tên in áo',
    defaultTitle: 'Đặt áo CLB',
    fields: [
      {
        key: 'size',
        label: 'Size áo',
        type: 'single_select',
        options: ['S', 'M', 'L', 'XL', 'XXL'],
        required: true,
      },
      {
        key: 'quantity',
        label: 'Số lượng',
        type: 'number',
        default: 1,
        min: 1,
        max: 10,
        required: true,
      },
      {
        key: 'name_on_jersey',
        label: 'Tên in áo (in sau lưng)',
        type: 'text',
        required: true,
      },
      { key: 'notes', label: 'Ghi chú', type: 'textarea' },
    ],
  },
  tournament: {
    label: 'Đăng ký giải',
    description: 'Đăng ký tham gia giải đấu nội bộ',
    defaultTitle: 'Đăng ký giải đấu CLB',
    fields: [
      {
        key: 'category',
        label: 'Hạng mục',
        type: 'single_select',
        options: ['Nam đôi', 'Nữ đôi', 'Hỗn hợp'],
        required: true,
      },
      { key: 'partner_name', label: 'Tên partner ghép cặp', type: 'text' },
      {
        key: 'shirt_size',
        label: 'Size áo thi đấu',
        type: 'single_select',
        options: ['S', 'M', 'L', 'XL'],
        required: true,
      },
      { key: 'notes', label: 'Ghi chú', type: 'textarea' },
    ],
  },
  attendance: {
    label: 'Điểm danh / đi ăn',
    description: 'Xác nhận tham gia 1 buổi đánh hoặc đi ăn',
    defaultTitle: 'Điểm danh buổi đánh',
    fields: [
      { key: 'attending', label: 'Tham gia?', type: 'yes_no', required: true },
      { key: 'plus_one', label: 'Đem theo người', type: 'yes_no' },
      { key: 'notes', label: 'Ghi chú', type: 'textarea' },
    ],
  },
}

export function validateField(
  field: FieldSchema,
  value: unknown
): string | null {
  if (field.required) {
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return `${field.label} là bắt buộc`
    }
  }
  if (field.type === 'number' && value !== null && value !== undefined && value !== '') {
    const n = Number(value)
    if (Number.isNaN(n)) return `${field.label} phải là số`
    if (typeof field.min === 'number' && n < field.min)
      return `${field.label} phải >= ${field.min}`
    if (typeof field.max === 'number' && n > field.max)
      return `${field.label} phải <= ${field.max}`
  }
  return null
}
