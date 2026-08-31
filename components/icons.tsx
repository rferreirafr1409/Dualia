// components/icons.tsx

import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

export function ShieldIcon({ size = 20, color = '#6B7F7A', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

export function JournalIcon({ size = 20, color = '#6B7F7A', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M9 12h6M9 16h6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function FinanceIcon({ size = 20, color = '#6B7F7A', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="9" r="5.5" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="15" cy="15" r="5.5" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function DocumentIcon({ size = 20, color = '#6B7F7A', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

export function InstitutionIcon({ size = 20, color = '#6B7F7A', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 21V9l8-5 8 5v12" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="M9 21v-6h6v6" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}

export function SealMark({ size = 90, color = '#F8F6F2', opacity = 0.14 }: IconProps & { opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none" opacity={opacity}>
      <Circle cx="50" cy="50" r="46" stroke={color} strokeWidth={1.2} />
      <Circle cx="50" cy="50" r="36" stroke={color} strokeWidth={1.2} /></Svg>
  );
}
export function BrandMark({ size = 16, color = '#F8F6F2' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M12 3l3 3-3 3-3-3z" />
      <Path d="M12 15l3 3-3 3-3-3z" />
      <Path d="M9 6H4v6a5 5 0 0 0 5 5" />
      <Path d="M15 6h5v6a5 5 0 0 1-5 5" />
    </Svg>
  );
}
export function ExportIcon({ size = 20, color = '#6B7F7A', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12M12 15l-4-4M12 15l4-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LockIcon({ size = 20, color = '#6B7F7A', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function HeartIcon({ size = 20, color = '#6B7F7A', filled = false, strokeWidth = 1.8 }: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <Path
        d="M12 20.5s-7.5-4.6-9.8-9C.6 8 1.8 4.5 5.2 3.6c2-.5 3.8.3 5 1.9.9-1.6 3-2.4 5-1.9 3.4.9 4.6 4.4 3 7.9-2.3 4.4-9.8 9-9.8 9z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
