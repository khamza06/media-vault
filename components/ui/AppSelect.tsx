'use client'

import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'

export type AppSelectOption = {
  disabled?: boolean
  label: string
  value: string
}

type AppSelectProps = {
  ariaLabel?: string
  className?: string
  contentClassName?: string
  disabled?: boolean
  itemClassName?: string
  onValueChange: (value: string) => void
  options: readonly AppSelectOption[]
  placeholder?: string
  value: string
}

const emptyValue = '__media_vault_empty_select_value__'

const defaultTriggerClassName =
  'inline-flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white shadow-sm outline-none transition hover:border-blue-400/60 focus:ring-2 focus:ring-blue-500/40 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[placeholder]:text-slate-500'
const defaultContentClassName =
  'z-[1200] max-h-[min(22rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/95 p-1 text-slate-100 shadow-2xl backdrop-blur'
const defaultItemClassName =
  'relative flex min-h-10 cursor-pointer select-none items-center rounded-xl py-2 pl-9 pr-3 text-sm text-slate-200 outline-none transition hover:bg-blue-500/15 focus:bg-blue-500/20 data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[state=checked]:bg-blue-500/20 data-[state=checked]:text-white'

export default function AppSelect({
  ariaLabel,
  className,
  contentClassName,
  disabled = false,
  itemClassName,
  onValueChange,
  options,
  placeholder,
  value,
}: AppSelectProps) {
  return (
    <Select.Root
      disabled={disabled}
      onValueChange={(nextValue) => onValueChange(fromSelectValue(nextValue))}
      value={toSelectValue(value)}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className={mergeClassNames(defaultTriggerClassName, className)}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon asChild>
          <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={mergeClassNames(defaultContentClassName, contentClassName)}
          position="popper"
          sideOffset={6}
        >
          <Select.Viewport className="max-h-[inherit] overflow-y-auto">
            {options.map((option) => (
              <Select.Item
                key={`${option.value}-${option.label}`}
                className={mergeClassNames(defaultItemClassName, itemClassName)}
                disabled={option.disabled}
                value={toSelectValue(option.value)}
              >
                <Select.ItemIndicator className="absolute left-3 inline-flex items-center justify-center text-blue-300">
                  <Check className="h-4 w-4" />
                </Select.ItemIndicator>
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

function toSelectValue(value: string) {
  return value === '' ? emptyValue : value
}

function fromSelectValue(value: string) {
  return value === emptyValue ? '' : value
}

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}
