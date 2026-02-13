import { cn } from '@/lib/utils';
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>){return <input className={cn('w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')} {...props}/>;}
