import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '~/lib/utils';

const buttonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-sm text-sm font-semibold whitespace-nowrap transition-[background-color,color,border-color,transform] duration-150 ease-out outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** Marker yellow: the one primary action on a screen. */
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover',
        /** Graphite: strong secondary actions (Continue, Next). */
        ink: 'bg-graphite text-shell-fg hover:bg-graphite-2',
        destructive: 'bg-evidence text-white hover:bg-red-ink',
        outline: 'border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-accent',
        secondary: 'bg-ground-2 text-ink hover:bg-[#e0e3dc]',
        ghost: 'text-ink-2 hover:bg-accent hover:text-ink',
        /** Ghost on the graphite shell. */
        shell: 'text-shell-muted hover:bg-graphite-2 hover:text-shell-fg',
        link: 'h-auto px-0 text-slate underline decoration-1 underline-offset-4 hover:text-ink',
      },
      size: {
        default: 'h-9 px-4 has-[>svg]:px-3',
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1.5 px-3 text-[13px] has-[>svg]:px-2.5',
        lg: 'h-11 px-5 text-[15px] has-[>svg]:px-4',
        xl: 'h-12 px-6 text-base has-[>svg]:px-5',
        icon: 'size-9',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
