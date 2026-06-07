import { supabase } from './supabase'

const BUCKET = 'avatars'
const TARGET_SIZE = 400
const QUALITY = 0.85

/**
 * Resize ảnh về 400x400 webp dùng canvas — không cần lib ngoài
 */
async function resizeToWebp(file: File): Promise<Blob> {
  const img = await fileToImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = TARGET_SIZE
  canvas.height = TARGET_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không lấy được canvas context')

  // Crop center square + scale to target
  const minSide = Math.min(img.width, img.height)
  const sx = (img.width - minSide) / 2
  const sy = (img.height - minSide) / 2
  ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, TARGET_SIZE, TARGET_SIZE)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Convert webp thất bại'))),
      'image/webp',
      QUALITY
    )
  })
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Không đọc được ảnh'))
    }
    img.src = url
  })
}

/**
 * Upload avatar cho 1 member.
 * - Resize 400x400 webp
 * - Xoá file cũ trong folder member
 * - Upload file mới với timestamp
 * - Return public URL
 */
export async function uploadAvatar(memberId: string, file: File): Promise<{
  url: string
  updatedAt: string
}> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh tối đa 5MB')
  if (!/^image\/(jpe?g|png|webp)$/i.test(file.type))
    throw new Error('Chỉ chấp nhận JPG, PNG, WEBP')

  const blob = await resizeToWebp(file)
  const ts = Date.now()
  const path = `${memberId}/${ts}.webp`

  // Xoá file cũ trong folder
  const { data: existing } = await supabase.storage.from(BUCKET).list(memberId)
  if (existing && existing.length > 0) {
    const toRemove = existing.map((f) => `${memberId}/${f.name}`)
    await supabase.storage.from(BUCKET).remove(toRemove)
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: true,
    })
  if (upErr) throw upErr

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const updatedAt = new Date().toISOString()

  const { error: dbErr } = await supabase
    .from('members')
    .update({ avatar_url: pub.publicUrl, avatar_updated_at: updatedAt })
    .eq('id', memberId)
  if (dbErr) throw dbErr

  return { url: pub.publicUrl, updatedAt }
}

export async function removeAvatar(memberId: string) {
  const { data: existing } = await supabase.storage.from(BUCKET).list(memberId)
  if (existing && existing.length > 0) {
    const toRemove = existing.map((f) => `${memberId}/${f.name}`)
    await supabase.storage.from(BUCKET).remove(toRemove)
  }
  await supabase
    .from('members')
    .update({ avatar_url: null, avatar_updated_at: new Date().toISOString() })
    .eq('id', memberId)
}
