import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Phone, UserPlus, UserCheck, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { downloadCSV, toCSV } from '../../lib/csv'
import { cn } from '../../lib/cn'
import type { WalkInCheckin } from '../../types/database'

type Filter = 'all' | 'pending_convert' | 'converted'

export function AdminWalkInTab() {
  const [items, setItems] = useState<WalkInCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('walk_in_checkins')
      .select('*')
      .order('checked_in_at', { ascending: false })
      .limit(200)
    if (error) {
      toast.error(friendlyError(error))
      setItems([])
    } else {
      setItems((data ?? []) as WalkInCheckin[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const total = items.length
    const converted = items.filter((i) => i.converted_to_member_id).length
    const pending = total - converted
    // Phone unique
    const uniquePhones = new Set(items.map((i) => i.phone)).size
    return { total, converted, pending, uniquePhones }
  }, [items])

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (filter === 'pending_convert' && i.converted_to_member_id) return false
      if (filter === 'converted' && !i.converted_to_member_id) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        return (
          i.full_name.toLowerCase().includes(q) ||
          i.phone.includes(q) ||
          (i.referral_source ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [items, filter, query])

  function exportCSV() {
    if (filtered.length === 0) {
      toast.error('Không có data để export')
      return
    }
    const rows = filtered.map((i) => ({
      time: new Date(i.checked_in_at).toLocaleString('vi-VN'),
      name: i.full_name,
      phone: i.phone,
      referral: i.referral_source ?? '',
      is_member: i.converted_to_member_id ? 'Yes' : 'No',
    }))
    const csv = toCSV(rows, [
      { key: 'time', label: 'Thời gian' },
      { key: 'name', label: 'Tên' },
      { key: 'phone', label: 'SĐT' },
      { key: 'referral', label: 'Biết qua' },
      { key: 'is_member', label: 'Đã là member' },
    ])
    downloadCSV(`walkin-leads-${Date.now()}`, csv)
    toast.success('Đã tải CSV')
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 p-4 bg-white border-b border-gray-100">
        <Stat label="Tổng" value={stats.total} color="gray" />
        <Stat label="SĐT unique" value={stats.uniquePhones} color="indigo" />
        <Stat label="Chưa member" value={stats.pending} color="red" />
        <Stat label="Đã convert" value={stats.converted} color="primary" />
      </div>

      {/* Controls */}
      <div className="p-4 bg-white border-b border-gray-100 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm tên / SĐT / referral..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 min-h-[40px] border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'pending_convert', 'converted'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-1 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap',
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              {f === 'all' && 'Tất cả'}
              {f === 'pending_convert' && 'Chưa convert'}
              {f === 'converted' && 'Đã convert'}
            </button>
          ))}
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="w-full py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV ({filtered.length})
        </button>
      </div>

      {/* List */}
      <div className="p-4 space-y-2">
        {loading && (
          <div className="text-center text-gray-500 text-sm py-8">Đang tải...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            <UserPlus className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            {query
              ? 'Không tìm thấy'
              : 'Chưa có khách vãng lai nào'}
          </div>
        )}
        {!loading &&
          filtered.map((i) => (
            <div key={i.id} className="bg-white rounded-xl p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">
                    {i.full_name}
                  </p>
                  <a
                    href={`tel:${i.phone}`}
                    className="text-xs text-primary flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="w-3 h-3" /> {i.phone}
                  </a>
                </div>
                {i.converted_to_member_id ? (
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                    <UserCheck className="w-2.5 h-2.5" />
                    MEMBER
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    CHƯA
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1.5">
                <span>{new Date(i.checked_in_at).toLocaleString('vi-VN')}</span>
                {i.referral_source && (
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                    {i.referral_source}
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'gray' | 'primary' | 'indigo' | 'red'
}) {
  const colors = {
    gray: 'text-gray-700',
    primary: 'text-primary',
    indigo: 'text-indigo-600',
    red: 'text-red-600',
  }
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <div className={cn('text-lg font-bold', colors[color])}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  )
}
