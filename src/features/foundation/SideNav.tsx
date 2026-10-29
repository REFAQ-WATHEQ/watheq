import { Link, useNavigate } from '@tanstack/react-router'
import { Home, UserRound, ShieldCheck, LogOut, LogIn, LayoutDashboard } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { supabase } from '@/integrations/supabase/client'
import { components } from './catalog'
import { isStaff } from './rules'

const linkClass = 'side-link'
// Visibility only; admin routes still enforce roles on their own.
export function SideNav({ open, onOpenChange, signedIn, roles }: { open: boolean; onOpenChange: (v: boolean) => void; signedIn: boolean; roles: string[] }) {
  const navigate = useNavigate()
  const close = () => onOpenChange(false)
  const staff = isStaff(roles)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" dir="rtl" className="side-nav w-[min(20rem,86vw)] overflow-y-auto p-0">
        <SheetHeader className="border-b border-border p-5 ps-12 text-start">
          <SheetTitle>قائمة وثيق</SheetTitle>
          <SheetDescription>التنقل بين أقسام المنصة</SheetDescription>
        </SheetHeader>
        <nav aria-label="القائمة الجانبية" className="grid gap-1 p-3">
          <p className="side-group">التنقل العام</p>
          <Link to="/" onClick={close} className={linkClass} activeProps={{ className: 'side-active', 'aria-current': 'page' }} activeOptions={{ exact: true }}><Home aria-hidden />الرئيسية</Link>
          {components.map(item => (
            <Link key={item.path} to={item.path} onClick={close} className={linkClass} activeProps={{ className: 'side-active', 'aria-current': 'page' }}><item.icon aria-hidden />{item.name}</Link>
          ))}
          <p className="side-group mt-4">الحساب والإدارة</p>
          {signedIn ? <>
            <Link to="/account" onClick={close} className={linkClass} activeProps={{ className: 'side-active', 'aria-current': 'page' }}><UserRound aria-hidden />حسابي</Link>
            {staff && <>
              <Link to="/admin" onClick={close} className={linkClass} activeProps={{ className: 'side-active', 'aria-current': 'page' }}><ShieldCheck aria-hidden />لوحة الإدارة</Link>
              <Link to="/dashboard" onClick={close} className={linkClass} activeProps={{ className: 'side-active', 'aria-current': 'page' }}><LayoutDashboard aria-hidden />لوحة البيانات</Link>
            </>}
            <button type="button" className={linkClass} onClick={async () => { close(); await supabase.auth.signOut(); navigate({ to: '/' }) }}><LogOut aria-hidden />تسجيل الخروج</button>
          </> : <Link to="/auth" search={{ next: "/account" }} onClick={close} className={linkClass}><LogIn aria-hidden />تسجيل الدخول</Link>}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
