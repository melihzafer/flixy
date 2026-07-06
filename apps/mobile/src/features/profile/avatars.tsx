import {
  Award,
  Camera,
  Clapperboard,
  Film,
  type LucideIcon,
  Sparkles,
  Star,
  Ticket,
  Tv,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text';
import { fonts } from '../../theme/tokens';

export type AvatarId =
  | 'film'
  | 'clapperboard'
  | 'camera'
  | 'ticket'
  | 'star'
  | 'award'
  | 'tv'
  | 'sparkles';

type AvatarDef = {
  id: AvatarId;
  Icon: LucideIcon;
  /** Solid icon + border color */
  color: string;
  /** Semi-transparent circle background (same hue, ~14% opacity) */
  bg: string;
  /** Semi-transparent border (same hue, ~35% opacity) */
  border: string;
};

export const PROFILE_AVATARS: AvatarDef[] = [
  {
    id: 'film',
    Icon: Film,
    color: '#FF4D1C',
    bg: 'rgba(255,77,28,0.14)',
    border: 'rgba(255,77,28,0.35)',
  },
  {
    id: 'clapperboard',
    Icon: Clapperboard,
    color: '#F5C842',
    bg: 'rgba(245,200,66,0.14)',
    border: 'rgba(245,200,66,0.35)',
  },
  {
    id: 'camera',
    Icon: Camera,
    color: '#5B8DEF',
    bg: 'rgba(91,141,239,0.14)',
    border: 'rgba(91,141,239,0.35)',
  },
  {
    id: 'ticket',
    Icon: Ticket,
    color: '#3DD68C',
    bg: 'rgba(61,214,140,0.14)',
    border: 'rgba(61,214,140,0.35)',
  },
  {
    id: 'star',
    Icon: Star,
    color: '#B47AFF',
    bg: 'rgba(180,122,255,0.14)',
    border: 'rgba(180,122,255,0.35)',
  },
  {
    id: 'award',
    Icon: Award,
    color: '#E05C4B',
    bg: 'rgba(224,92,75,0.14)',
    border: 'rgba(224,92,75,0.35)',
  },
  {
    id: 'tv',
    Icon: Tv,
    color: '#4ECDC4',
    bg: 'rgba(78,205,196,0.14)',
    border: 'rgba(78,205,196,0.35)',
  },
  {
    id: 'sparkles',
    Icon: Sparkles,
    color: '#FF6B9D',
    bg: 'rgba(255,107,157,0.14)',
    border: 'rgba(255,107,157,0.35)',
  },
];

const AVATAR_MAP = new Map<AvatarId, AvatarDef>(PROFILE_AVATARS.map((a) => [a.id, a]));

export const DEFAULT_AVATAR_ID: AvatarId = 'film';

export function getAvatarDef(id: string | null | undefined): AvatarDef {
  if (id && AVATAR_MAP.has(id as AvatarId)) {
    return AVATAR_MAP.get(id as AvatarId) as AvatarDef;
  }
  return AVATAR_MAP.get(DEFAULT_AVATAR_ID) as AvatarDef;
}

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && AVATAR_MAP.has(value as AvatarId);
}

type AvatarIconProps = {
  avatarId: string | null | undefined;
  size?: number;
  /** Show the display-name initial instead of an icon (for users who haven't picked one) */
  fallbackInitial?: string;
};

export const AvatarIcon: ComponentType<AvatarIconProps> = function AvatarIcon({
  avatarId,
  size = 64,
  fallbackInitial,
}: AvatarIconProps) {
  const def = getAvatarDef(avatarId);
  const hasExplicitAvatar = isAvatarId(avatarId);
  const iconSize = Math.round(size * 0.48);
  const initialFontSize = Math.round(size * 0.42);

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: def.bg,
          borderColor: def.border,
        },
      ]}
    >
      {hasExplicitAvatar ? (
        <def.Icon size={iconSize} color={def.color} strokeWidth={2.0} />
      ) : (
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: fonts.display,
            fontSize: initialFontSize,
            lineHeight: Math.round(size * 0.7),
            color: def.color,
            textAlign: 'center',
            includeFontPadding: false,
            textAlignVertical: 'center',
          }}
        >
          {fallbackInitial || 'F'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
});
