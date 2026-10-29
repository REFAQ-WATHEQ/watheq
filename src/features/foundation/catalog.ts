import { BookOpen, GraduationCap, Newspaper, Video, Route, Lightbulb, MessageCircle, Building2 } from 'lucide-react'
export const components = [
 {path:'/documents',name:'مكتبة الوثائق',description:'المراجع والوثائق المؤسسية',icon:BookOpen},
 {path:'/learning',name:'التعلم الإلكتروني',description:'مساحة للتعلم وبناء القدرات',icon:GraduationCap},
 {path:'/blog',name:'المدونة المعرفية',description:'مقالات وأفكار تثري المعرفة',icon:Newspaper},
 {path:'/meetings',name:'اللقاءات والفيديوهات',description:'معرفة تتشاركها الخبرات',icon:Video},
 {path:'/plans',name:'خطط التعلم',description:'مسارات لتنمية المعرفة',icon:Route},
 {path:'/lessons',name:'الدروس المستفادة',description:'خبرات اليوم لممارسات الغد',icon:Lightbulb},
 {path:'/ask',name:'اسأل وثيق',description:'مساحة للأسئلة المعرفية',icon:MessageCircle},
 {path:'/visits',name:'طلب تنسيق زيارة لرفاق',description:'تواصل وتبادل للخبرات',icon:Building2},
] as const
