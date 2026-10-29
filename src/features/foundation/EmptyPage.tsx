import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Shell,PageTitle } from './Shell'
export function EmptyPage({title}:{title:string}){return <Shell><PageTitle title={title} subtitle="من مكونات منصة وثيق المعرفية"/><div className="site-width py-20 text-center"><BookOpen className="mx-auto mb-5 size-12 text-muted-foreground" strokeWidth={1}/><h2 className="text-xl font-semibold">هذه المساحة قيد التجهيز</h2><p className="mt-3 text-sm text-muted-foreground">لم تُضف محتويات بعد. يتاح هذا المكون في إحدى المراحل القادمة.</p><Button asChild variant="outline" className="mt-7"><Link to="/"><ArrowRight/>العودة للرئيسة</Link></Button></div></Shell>}
