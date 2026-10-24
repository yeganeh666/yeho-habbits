import { avatarColor } from "@/lib/friends";

export const Avatar = ({ email, size = 44 }: { email: string; size?: number }) => (
  <span aria-hidden className="grid shrink-0 place-items-center rounded-full font-extrabold text-white" style={{ width: size, height: size, background: avatarColor(email), fontSize: size * 0.42 }}>{(email[0] || "?").toUpperCase()}</span>
);
