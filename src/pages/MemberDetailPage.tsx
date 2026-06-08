import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, Trash2, Phone, MessageCircle, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { uploadAvatar, removeAvatar } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { MemberAvatar } from '../components/members/MemberAvatar'
import { SkillBadge } from '../components/members/SkillBadge'
import { RoleBadges } from '../components/members/RoleBadges'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import type { Member, SkillLevel } from '../types/database'
import { GENDER_LABEL, PLAY_EXPERIENCE_LABEL } from '../types/database'
import { cn } from '../lib/cn'

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { member: me, user, isAdmin, refreshMember } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Editable fields
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [zaloId, setZaloId] = useState('')
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('C')

  const isOwn = me?.id === id
  const canEditProfile = isOwn || isAdmin
  // Skill: Host/Admin/Coach mới được chấm trình
  const canEditSkill = isAdmin || (me?.is_host ?? false) || (me?.is_coach ?? false)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!id) return
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (!mounted) return
      if (error) {
        toast.error(friendlyError(error))
      } else if (data) {
        const m = data as Member
        setMember(m)
        setBio(m.bio ?? '')
        setPhone(m.phone ?? '')
        setZaloId(m.zalo_id ?? '')
        setSkillLevel(m.skill_level)
      }
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [id])

  async function onSave() {
    if (!member) return
    setSaving(true)
    const updates: Record<string, unknown> = {
      bio: bio.trim() || null,
      phone: phone.trim() || null,
      zalo_id: zaloId.trim() || null,
    }
    if (canEditSkill && skillLevel !== member.skill_level) {
      updates.skill_level = skillLevel
      updates.skill_updated_by = user?.id ?? null
      updates.skill_updated_at = new Date().toISOString()
    }
    const { error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', member.id)
    setSaving(false)
    if (error) {
      console.error('[MemberDetailPage] UPDATE error:', error)
      toast.error(friendlyError(error))
      return
    }
    toast.success('Đã lưu')
    setMember({ ...member, ...(updates as Partial<Member>) })
    if (isOwn) await refreshMember()
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !member) return
    setUploading(true)
    try {
      const res = await uploadAvatar(member.id, file)
      setMember({ ...member, avatar_url: res.url, avatar_updated_at: res.updatedAt })
      toast.success('Đã cập nhật ảnh')
      if (isOwn) await refreshMember()
    } catch (err: unknown) {
      toast.error(friendlyError(err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function onRemoveAvatar() {
    if (!member) return
    if (!confirm('Xoá ảnh đại diện?')) return
    try {
      await removeAvatar(member.id)
      setMember({ ...member, avatar_url: null })
      toast.success('Đã xoá ảnh')
      if (isOwn) await refreshMember()
    } catch (err: unknown) {
      toast.error(friendlyError(err))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600 mb-4">Không tìm thấy thành viên này</p>
        <Link to="/members" className="text-primary underline">
          Về danh sách
        </Link>
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold truncate">{member.full_name}</h1>
      </header>

      {/* Avatar block */}
      <div className="bg-white py-6 px-4 flex flex-col items-center border-b border-gray-100">
        <div className="relative">
          <MemberAvatar member={member} size="xl" />
          {canEditProfile && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary-600 disabled:opacity-50"
                aria-label="Đổi ảnh"
              >
                {uploading ? (
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onPickAvatar}
                className="hidden"
              />
            </>
          )}
        </div>
        <h2 className="mt-3 text-xl font-bold">{member.full_name}</h2>
        <div className="mt-2 flex items-center gap-2">
          <SkillBadge level={member.skill_level} size="lg" />
          <RoleBadges member={member} size="md" showIcon />
        </div>
        {canEditProfile && member.avatar_url && (
          <button
            onClick={onRemoveAvatar}
            className="mt-2 text-xs text-red-600 underline flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Xoá ảnh
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-4">
        {member.email && (
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-gray-400" />
            <span>{member.email}</span>
          </div>
        )}

        {/* Gender + Experience badges */}
        {(member.gender || member.play_experience) && (
          <div className="grid grid-cols-2 gap-2">
            {member.gender && (
              <div
                className={cn(
                  'rounded-xl p-3 flex items-center gap-2 border',
                  member.gender === 'male'
                    ? 'bg-blue-50 border-blue-100'
                    : 'bg-pink-50 border-pink-100'
                )}
              >
                <span className="text-xl">
                  {member.gender === 'male' ? '👨' : '👩'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">
                    Giới tính
                  </p>
                  <p
                    className={cn(
                      'text-sm font-semibold truncate',
                      member.gender === 'male' ? 'text-blue-700' : 'text-pink-700'
                    )}
                  >
                    {GENDER_LABEL[member.gender]}
                  </p>
                </div>
              </div>
            )}
            {member.play_experience && (
              <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2 border border-gray-100">
                <span className="text-xl">
                  {member.play_experience === 'beginner' && '🌱'}
                  {member.play_experience === 'under_6m' && '🏓'}
                  {member.play_experience === 'over_6m' && '🔥'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">
                    Kinh nghiệm
                  </p>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {PLAY_EXPERIENCE_LABEL[member.play_experience]}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {canEditProfile ? (
          <div className="space-y-3 bg-white rounded-xl p-4">
            <Input
              label="Số điện thoại"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
            />
            <Input
              label="Zalo ID"
              value={zaloId}
              onChange={(e) => setZaloId(e.target.value)}
              placeholder="zalo_username"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Giới thiệu</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                placeholder="Vài dòng giới thiệu bản thân..."
              />
            </div>

            {canEditSkill && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  Đánh giá trình độ <span className="text-xs text-gray-500">(Host/Coach/Admin)</span>
                </label>
                <div className="flex gap-2">
                  {(['A', 'B+', 'B-', 'C'] as SkillLevel[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSkillLevel(s)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                        skillLevel === s
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={onSave} loading={saving} className="w-full">
              Lưu thay đổi
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4 space-y-3 text-sm">
            {member.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400" />
                <a href={`tel:${member.phone}`} className="text-primary">
                  {member.phone}
                </a>
              </div>
            )}
            {member.zalo_id && (
              <div className="flex items-center gap-3">
                <MessageCircle className="w-4 h-4 text-gray-400" />
                <span>Zalo: {member.zalo_id}</span>
              </div>
            )}
            {member.bio && <p className="text-gray-700 pt-2 border-t border-gray-100">{member.bio}</p>}
          </div>
        )}

        <div className="text-xs text-gray-400 text-center pt-2">
          Tham gia từ {new Date(member.joined_at).toLocaleDateString('vi-VN')}
        </div>
      </div>
    </div>
  )
}
