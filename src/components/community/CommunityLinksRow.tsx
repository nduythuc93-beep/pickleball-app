import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import type { CommunityLink } from '../../types/database'

type Variant = 'compact' | 'prominent'

/**
 * Public row of social channel links.
 * Only renders if at least one platform has an active URL set by admin.
 *
 * compact   — small chip row (e.g. inside walk-in landing)
 * prominent — banner card with header (e.g. on HomePage)
 */
export function CommunityLinksRow({ variant = 'prominent' }: { variant?: Variant }) {
  const [links, setLinks] = useState<CommunityLink[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase
        .from('community_links')
        .select('*')
        .eq('is_active', true)
        .not('url', 'is', null)
        .order('display_order')
      if (!mounted) return
      setLinks((data ?? []) as CommunityLink[])
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  if (loading || links.length === 0) return null

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {links.map((link) => (
          <CompactPill key={link.platform} link={link} />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Globe className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-tight">
            Kết nối 8FM
          </p>
          <p className="text-[10px] text-gray-500 leading-tight">
            Theo dõi cộng đồng trên các kênh
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {links.map((link) => (
          <ChannelPill key={link.platform} link={link} />
        ))}
      </div>
    </div>
  )
}

function ChannelPill({ link }: { link: CommunityLink }) {
  return (
    <a
      href={link.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm',
        'text-white hover:opacity-90 active:scale-95 transition-all'
      )}
      style={{ backgroundColor: link.brand_color }}
    >
      <PlatformIcon platform={link.platform} />
      {link.label}
    </a>
  )
}

function CompactPill({ link }: { link: CommunityLink }) {
  return (
    <a
      href={link.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
      style={{ backgroundColor: link.brand_color }}
      aria-label={link.label}
      title={link.label}
    >
      <PlatformIcon platform={link.platform} />
    </a>
  )
}

/**
 * Inline SVG icons for major social platforms.
 * Lightweight, no external icon dependency.
 */
function PlatformIcon({ platform }: { platform: string }) {
  const cls = 'w-3.5 h-3.5 fill-current'
  switch (platform) {
    case 'zalo':
      return (
        <span className="text-[11px] font-extrabold leading-none">Z</span>
      )
    case 'facebook':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.408.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24h-1.918c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.592 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z" />
        </svg>
      )
    case 'instagram':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      )
    case 'threads':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.781 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.286 1.33-3.083.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L8.137 8.59c.98-1.461 2.568-2.264 4.471-2.264h.044c3.187.02 5.087 1.953 5.275 5.341.108.046.216.094.323.144 1.495.703 2.588 1.769 3.16 3.083.797 1.832.871 4.814-1.561 7.197C18.106 22.972 15.681 23.954 12.186 24zm.706-9.79c-.32 0-.65.01-.99.03-1.846.106-2.997.952-2.93 2.16.07 1.265 1.466 1.853 2.81 1.78 1.235-.067 2.848-.548 3.119-3.762a10.59 10.59 0 0 0-2.009-.208z" />
        </svg>
      )
    case 'telegram':
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      )
    case 'website':
      return <Globe className="w-3.5 h-3.5" />
    default:
      return <Globe className="w-3.5 h-3.5" />
  }
}
