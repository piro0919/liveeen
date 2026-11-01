/** 上の帯・下のタブ・シートのアイコン。線で描き、字の色に従う */
function Icon({
  children,
  className = 'size-6',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function HomeIcon() {
  return (
    <Icon>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </Icon>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </Icon>
  );
}

export function FollowingIcon() {
  return (
    <Icon>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" />
      <path d="M18 14.9c2 .7 3.2 2.4 3.5 5.1" />
    </Icon>
  );
}

export function BroadcastIcon() {
  return (
    <Icon>
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="m15 10.5 6-3.5v10l-6-3.5" />
    </Icon>
  );
}

export function ShareIcon() {
  return (
    <Icon>
      <path d="m14 5 7 7-7 7" />
      <path d="M21 12H10a7 7 0 0 0-7 7" />
    </Icon>
  );
}

export function MoreIcon() {
  return (
    <Icon>
      <path d="M5 12h.01" />
      <path d="M12 12h.01" />
      <path d="M19 12h.01" />
    </Icon>
  );
}

export function FlagIcon() {
  return (
    <Icon>
      <path d="M5 21V4" />
      <path d="M5 4h13l-3 4.5 3 4.5H5" />
    </Icon>
  );
}

export function TrashIcon() {
  return (
    <Icon>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 14h10l1-14" />
    </Icon>
  );
}

export function BlockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </Icon>
  );
}

export function ModeratorIcon() {
  return (
    <Icon>
      <path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6z" />
    </Icon>
  );
}

export function MicIcon() {
  return (
    <Icon>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </Icon>
  );
}

export function MicOffIcon() {
  return (
    <Icon>
      <path d="M15 9V6a3 3 0 0 0-5.7-1.3" />
      <path d="M9 9v2a3 3 0 0 0 4.6 2.5" />
      <path d="M5 11a7 7 0 0 0 11 5.7" />
      <path d="M19 11a7 7 0 0 1-.5 2.6" />
      <path d="M12 18v3" />
      <path d="m3 3 18 18" />
    </Icon>
  );
}

export function HideIcon() {
  return (
    <Icon>
      <path d="M10 5.2A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-2.7 3.5" />
      <path d="M6.4 6.9A15.5 15.5 0 0 0 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5-1.4" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </Icon>
  );
}

export function SwitchCameraIcon() {
  return (
    <Icon>
      <path d="M3 9a2 2 0 0 1 2-2h2.5L9 4.5h6L16.5 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M15.5 12a3.5 3.5 0 0 0-6.2-1.7" />
      <path d="M8.5 14a3.5 3.5 0 0 0 6.2 1.7" />
      <path d="M9 8.5v2h2" />
      <path d="M15 17.5v-2h-2" />
    </Icon>
  );
}

export function MusicIcon() {
  return (
    <Icon>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </Icon>
  );
}

export function EditIcon() {
  return (
    <Icon>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="m13 7 4 4" />
    </Icon>
  );
}

export function CommentIcon() {
  return (
    <Icon>
      <path d="M4 5h16v12H9l-5 4z" />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </Icon>
  );
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function MyPageIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.7-4.2 3.8-6.5 8-6.5s7.3 2.3 8 6.5" />
    </Icon>
  );
}
