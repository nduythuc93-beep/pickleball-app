import { Link } from 'react-router-dom'
import { MemberAvatar } from './MemberAvatar'
import { SkillBadge } from './SkillBadge'
import { RoleBadges } from './RoleBadges'
import type { Member } from '../../types/database'

type Props = {
  member: Member
}

export function MemberCard({ member }: Props) {
  return (
    <Link
      to={`/members/${member.id}`}
      className="bg-white rounded-xl p-3 flex items-center gap-3 active:bg-gray-50 hover:bg-gray-50 transition-colors"
    >
      <MemberAvatar member={member} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 truncate">{member.full_name}</span>
          <RoleBadges member={member} />
        </div>
        {member.bio && <p className="text-xs text-gray-500 truncate mt-0.5">{member.bio}</p>}
      </div>
      <SkillBadge level={member.skill_level} />
    </Link>
  )
}
