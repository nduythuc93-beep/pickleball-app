import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { uploadRewardImage, removeRewardImage } from '../../lib/storage'
import { useAuth } from '../../hooks/useAuth'
import type { Reward } from '../../types/database'

type Props = {
  open: boolean
  onClose: () => void
  reward?: Reward | null
  onSaved: () => void
}

export function RewardFormModal({ open, onClose, reward, onSaved }: Props) {
  const { user } = useAuth()
  const isEdit = Boolean(reward)
  const imageRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [costPoints, setCostPoints] = useState('100')
  const [stock, setStock] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [displayOrder, setDisplayOrder] = useState('0')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (reward) {
      setName(reward.name)
      setDescription(reward.description ?? '')
      setCostPoints(String(reward.cost_points))
      setStock(reward.stock !== null ? String(reward.stock) : '')
      setIsActive(reward.is_active)
      setDisplayOrder(String(reward.display_order))
      setImagePreview(reward.image_url ?? null)
    } else {
      setName('')
      setDescription('')
      setCostPoints('100')
      setStock('')
      setIsActive(true)
      setDisplayOrder('0')
      setImagePreview(null)
    }
    setImageFile(null)
  }, [open, reward])

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh tối đa 5MB')
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function onRemoveImage() {
    if (!reward?.image_url) {
      setImageFile(null)
      setImagePreview(null)
      if (imageRef.current) imageRef.current.value = ''
      return
    }
    if (!confirm('Xoá ảnh hiện tại?')) return
    try {
      await removeRewardImage(reward.id)
      setImageFile(null)
      setImagePreview(null)
      toast.success('Đã xoá ảnh')
      onSaved()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  async function onSubmit() {
    if (!name.trim()) {
      toast.error('Nhập tên quà')
      return
    }
    const cost = parseInt(costPoints, 10)
    if (Number.isNaN(cost) || cost < 0) {
      toast.error('Giá điểm không hợp lệ')
      return
    }
    setSaving(true)

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      cost_points: cost,
      stock: stock.trim() ? parseInt(stock, 10) : null,
      is_active: isActive,
      display_order: parseInt(displayOrder, 10) || 0,
    }

    let rewardId = reward?.id ?? null
    let error
    if (isEdit && reward) {
      ;({ error } = await supabase.from('rewards').update(payload).eq('id', reward.id))
    } else {
      const { data, error: insErr } = await supabase
        .from('rewards')
        .insert({ ...payload, created_by: user?.id ?? null })
        .select('id')
        .single()
      error = insErr
      rewardId = data?.id ?? null
    }

    if (error) {
      setSaving(false)
      toast.error(friendlyError(error))
      return
    }

    if (imageFile && rewardId) {
      try {
        await uploadRewardImage(rewardId, imageFile)
      } catch (err) {
        setSaving(false)
        toast.error(friendlyError(err))
        return
      }
    }

    setSaving(false)
    toast.success(isEdit ? 'Đã cập nhật' : 'Đã thêm quà')
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Sửa: ${reward?.name}` : 'Thêm quà mới'}
      footer={
        <div className="flex gap-2">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Huỷ
          </Button>
          <Button onClick={onSubmit} loading={saving} className="flex-1">
            {isEdit ? 'Lưu' : 'Thêm'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Image */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Ảnh quà (1:1 — square)
          </label>
          <input
            ref={imageRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPickImage}
            className="hidden"
          />
          {imagePreview ? (
            <div className="relative rounded-lg overflow-hidden border border-gray-200">
              <img src={imagePreview} alt="Preview" className="w-full aspect-square object-cover" />
              <div className="absolute bottom-2 right-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => imageRef.current?.click()}
                  className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-gray-800"
                >
                  Đổi ảnh
                </button>
                <button
                  type="button"
                  onClick={onRemoveImage}
                  className="bg-red-500/90 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Xoá
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageRef.current?.click()}
              className="w-full aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5"
            >
              <ImagePlus className="w-8 h-8" />
              <span className="text-xs font-medium">Thêm ảnh</span>
            </button>
          )}
        </div>

        <Input
          label="Tên quà *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Áo CLB"
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Mô tả ngắn về quà..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Giá điểm *"
            type="number"
            value={costPoints}
            onChange={(e) => setCostPoints(e.target.value)}
            min={0}
            step={10}
          />
          <Input
            label="Số lượng (trống = không giới hạn)"
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            min={0}
            placeholder="∞"
          />
        </div>

        <Input
          label="Display order"
          type="number"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded text-primary"
          />
          Đang mở (uncheck = ẩn khỏi catalog)
        </label>
      </div>
    </Modal>
  )
}
