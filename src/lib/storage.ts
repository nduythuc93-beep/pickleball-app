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
  const { data: existing, error: listErr } = await supabase.storage.from(BUCKET).list(memberId)
  if (listErr) console.warn('[uploadAvatar] list error:', listErr)
  if (existing && existing.length > 0) {
    const toRemove = existing.map((f) => `${memberId}/${f.name}`)
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(toRemove)
    if (rmErr) console.warn('[uploadAvatar] remove old error:', rmErr)
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: true,
    })
  if (upErr) {
    console.error('[uploadAvatar] storage upload failed:', upErr, { path, memberId })
    throw new Error(`Upload thất bại: ${upErr.message}`)
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const updatedAt = new Date().toISOString()

  const { error: dbErr } = await supabase
    .from('members')
    .update({ avatar_url: pub.publicUrl, avatar_updated_at: updatedAt })
    .eq('id', memberId)
  if (dbErr) {
    console.error('[uploadAvatar] db update failed:', dbErr, { memberId })
    throw new Error(`Lưu avatar URL thất bại: ${dbErr.message}`)
  }

  return { url: pub.publicUrl, updatedAt }
}

// ========================================
// TOURNAMENT BANNER
// ========================================

const BANNER_W = 1200
const BANNER_H = 630

/**
 * Resize ảnh về 1200x630 webp với cover-fit (crop center).
 */
async function resizeBannerWebp(file: File): Promise<Blob> {
  const img = await fileToImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = BANNER_W
  canvas.height = BANNER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không lấy được canvas context')

  // Cover fit: scale to fill, crop overflow center
  const scale = Math.max(BANNER_W / img.width, BANNER_H / img.height)
  const w = img.width * scale
  const h = img.height * scale
  const dx = (BANNER_W - w) / 2
  const dy = (BANNER_H - h) / 2
  ctx.drawImage(img, dx, dy, w, h)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Convert webp thất bại'))),
      'image/webp',
      QUALITY
    )
  })
}

/**
 * Upload banner cho 1 tournament.
 * - Resize 1200x630 webp (16:9-ish)
 * - Lưu trong avatars bucket, folder tournaments/{tournamentId}
 * - Xoá banner cũ trước khi upload mới
 */
export async function uploadTournamentBanner(
  tournamentId: string,
  file: File
): Promise<{ url: string; updatedAt: string }> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Ảnh tối đa 10MB')
  if (!/^image\/(jpe?g|png|webp)$/i.test(file.type))
    throw new Error('Chỉ chấp nhận JPG, PNG, WEBP')

  const blob = await resizeBannerWebp(file)
  const ts = Date.now()
  const folder = `tournaments/${tournamentId}`
  const path = `${folder}/${ts}.webp`

  // Xoá file cũ
  const { data: existing } = await supabase.storage.from(BUCKET).list(folder)
  if (existing && existing.length > 0) {
    const toRemove = existing.map((f) => `${folder}/${f.name}`)
    await supabase.storage.from(BUCKET).remove(toRemove)
  }

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '3600',
    upsert: true,
  })
  if (upErr) {
    console.error('[uploadTournamentBanner] storage error:', upErr)
    throw new Error(`Upload thất bại: ${upErr.message}`)
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const updatedAt = new Date().toISOString()

  const { error: dbErr } = await supabase
    .from('tournaments')
    .update({ banner_url: pub.publicUrl, banner_updated_at: updatedAt })
    .eq('id', tournamentId)
  if (dbErr) {
    console.error('[uploadTournamentBanner] db error:', dbErr)
    throw new Error(`Lưu banner URL thất bại: ${dbErr.message}`)
  }

  return { url: pub.publicUrl, updatedAt }
}

// ========================================
// REWARD IMAGE
// ========================================

const REWARD_W = 600
const REWARD_H = 600

async function resizeRewardWebp(file: File): Promise<Blob> {
  const img = await fileToImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = REWARD_W
  canvas.height = REWARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không lấy được canvas context')

  // Cover fit square center crop
  const scale = Math.max(REWARD_W / img.width, REWARD_H / img.height)
  const w = img.width * scale
  const h = img.height * scale
  const dx = (REWARD_W - w) / 2
  const dy = (REWARD_H - h) / 2
  ctx.drawImage(img, dx, dy, w, h)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Convert webp thất bại'))),
      'image/webp',
      QUALITY
    )
  })
}

export async function uploadRewardImage(
  rewardId: string,
  file: File
): Promise<{ url: string; updatedAt: string }> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh tối đa 5MB')
  if (!/^image\/(jpe?g|png|webp)$/i.test(file.type))
    throw new Error('Chỉ chấp nhận JPG, PNG, WEBP')

  const blob = await resizeRewardWebp(file)
  const ts = Date.now()
  const folder = `rewards/${rewardId}`
  const path = `${folder}/${ts}.webp`

  const { data: existing } = await supabase.storage.from(BUCKET).list(folder)
  if (existing && existing.length > 0) {
    const toRemove = existing.map((f) => `${folder}/${f.name}`)
    await supabase.storage.from(BUCKET).remove(toRemove)
  }

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '3600',
    upsert: true,
  })
  if (upErr) throw new Error(`Upload thất bại: ${upErr.message}`)

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const updatedAt = new Date().toISOString()

  const { error: dbErr } = await supabase
    .from('rewards')
    .update({ image_url: pub.publicUrl, image_updated_at: updatedAt })
    .eq('id', rewardId)
  if (dbErr) throw new Error(`Lưu reward image URL thất bại: ${dbErr.message}`)

  return { url: pub.publicUrl, updatedAt }
}

export async function removeRewardImage(rewardId: string) {
  const folder = `rewards/${rewardId}`
  const { data: existing } = await supabase.storage.from(BUCKET).list(folder)
  if (existing && existing.length > 0) {
    const toRemove = existing.map((f) => `${folder}/${f.name}`)
    await supabase.storage.from(BUCKET).remove(toRemove)
  }
  await supabase
    .from('rewards')
    .update({ image_url: null, image_updated_at: new Date().toISOString() })
    .eq('id', rewardId)
}

export async function removeTournamentBanner(tournamentId: string) {
  const folder = `tournaments/${tournamentId}`
  const { data: existing } = await supabase.storage.from(BUCKET).list(folder)
  if (existing && existing.length > 0) {
    const toRemove = existing.map((f) => `${folder}/${f.name}`)
    await supabase.storage.from(BUCKET).remove(toRemove)
  }
  await supabase
    .from('tournaments')
    .update({ banner_url: null, banner_updated_at: new Date().toISOString() })
    .eq('id', tournamentId)
}

// ========================================
// AVATAR
// ========================================

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
