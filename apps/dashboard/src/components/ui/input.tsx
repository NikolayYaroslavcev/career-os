import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

export interface InputProps extends React.ComponentProps<"input"> {
  label?: string
  error?: string
}

function Input({ className, type, label, error, id, ...props }: InputProps): React.JSX.Element {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")

  const input = (
    <InputPrimitive
      type={type}
      id={inputId}
      data-slot="input"
      aria-invalid={!!error}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )

  if (!label && !error) {
    return input
  }

  return (
    <div className="space-y-1">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      {input}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export { Input }
