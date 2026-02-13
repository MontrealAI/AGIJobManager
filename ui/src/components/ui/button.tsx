import * as React from 'react';
import { cn } from '@/lib/utils';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'destructive' };
export function Button({ className, variant='default', ...props }: Props){
  return <button className={cn('inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',variant==='default'&&'bg-primary text-primary-foreground hover:bg-accent',variant==='outline'&&'border border-border bg-transparent hover:bg-muted',variant==='destructive'&&'bg-destructive text-destructive-foreground hover:opacity-90',className)} {...props}/>;
}
