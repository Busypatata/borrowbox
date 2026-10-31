import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Settings, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { Avatar } from '@/components/ui/Misc';

export function AccountMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const logout = useLogout();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (!user) return null;

  const item = 'flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-blush/30';
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Account menu" className="flex items-center gap-1.5 rounded-xl p-1.5 hover:bg-blush/50">
        <Avatar name={user.name} src={user.profileImageUrl} size={32} />
        <ChevronDown className="hidden h-4 w-4 sm:block" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-blush bg-white py-1 shadow-pop">
          <div className="border-b border-blush/70 px-4 py-3">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-charcoal-70">{user.email}</p>
          </div>
          <Link to="/dashboard" className={item} onClick={() => setOpen(false)}><LayoutDashboard className="h-4 w-4" aria-hidden />Dashboard</Link>
          <Link to="/profile" className={item} onClick={() => setOpen(false)}><User className="h-4 w-4" aria-hidden />My profile</Link>
          <Link to="/settings" className={item} onClick={() => setOpen(false)}><Settings className="h-4 w-4" aria-hidden />Settings</Link>
          {user.role === 'ADMIN' && <Link to="/admin/reports" className={item} onClick={() => setOpen(false)}><ShieldCheck className="h-4 w-4" aria-hidden />Moderation</Link>}
          <button
            type="button"
            className={`${item} border-t border-blush/70`}
            onClick={() => logout.mutate(undefined, { onSuccess: () => { setOpen(false); toast.success('Signed out'); navigate('/'); } })}
          >
            <LogOut className="h-4 w-4" aria-hidden />{logout.isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}
