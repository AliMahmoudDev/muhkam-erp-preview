"use client"

import * as React from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: string
  label: string
  disabled?: boolean
}

export interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  clearable?: boolean
  id?: string
  searchable?: boolean
}

const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = "اختر...",
      searchPlaceholder = "بحث...",
      emptyText = "لا توجد نتائج",
      disabled,
      className,
      clearable = false,
      searchable = true,
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery]   = React.useState("")
    const triggerRef  = React.useRef<HTMLButtonElement>(null)
    const searchRef   = React.useRef<HTMLInputElement>(null)
    const panelRef    = React.useRef<HTMLDivElement>(null)

    React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement)

    const selected = options.find((o) => o.value === value)

    const filtered = searchable && query
      ? options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase())
        )
      : options

    const handleSelect = (opt: ComboboxOption) => {
      if (opt.disabled) return
      onChange?.(opt.value)
      setOpen(false)
      setQuery("")
    }

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange?.("")
      setOpen(false)
      setQuery("")
    }

    React.useEffect(() => {
      if (open && searchable) {
        setTimeout(() => searchRef.current?.focus(), 10)
      }
    }, [open, searchable])

    React.useEffect(() => {
      if (!open) return
      const handlePointerDown = (e: PointerEvent) => {
        if (
          !triggerRef.current?.contains(e.target as Node) &&
          !panelRef.current?.contains(e.target as Node)
        ) {
          setOpen(false)
          setQuery("")
        }
      }
      document.addEventListener("pointerdown", handlePointerDown)
      return () => document.removeEventListener("pointerdown", handlePointerDown)
    }, [open])

    return (
      <div className="erp-combobox-root">
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn("erp-combobox-trigger erp-input", className)}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              setOpen((o) => !o)
            }
            if (e.key === "Escape") {
              setOpen(false)
              setQuery("")
            }
          }}
        >
          <span className={cn("erp-combobox-value", !selected && "erp-combobox-placeholder")}>
            {selected ? selected.label : placeholder}
          </span>
          <span className="erp-combobox-icons">
            {clearable && selected && (
              <span
                role="button"
                aria-label="مسح"
                className="erp-combobox-clear"
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e as unknown as React.MouseEvent)}
                tabIndex={0}
              >
                <X />
              </span>
            )}
            <ChevronDown
              className={cn(
                "erp-combobox-chevron",
                open && "erp-combobox-chevron--open"
              )}
            />
          </span>
        </button>

        {open && (
          <div
            ref={panelRef}
            className={cn("erp-combobox-panel", !searchable && "erp-combobox-panel--compact")}
            role="listbox"
          >
            {searchable && (
              <div className="erp-combobox-search-wrap">
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="erp-combobox-search"
                />
              </div>
            )}
            <div className="erp-combobox-list">
              {filtered.length === 0 ? (
                <div className="erp-combobox-empty">{emptyText}</div>
              ) : (
                filtered.map((opt) => (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={opt.value === value}
                    aria-disabled={opt.disabled}
                    className={cn(
                      "erp-combobox-item",
                      opt.value === value && "erp-combobox-item--selected",
                      opt.disabled && "erp-combobox-item--disabled"
                    )}
                    onClick={() => handleSelect(opt)}
                    onKeyDown={(e) => e.key === "Enter" && handleSelect(opt)}
                    tabIndex={opt.disabled ? -1 : 0}
                  >
                    <span>{opt.label}</span>
                    {opt.value === value && (
                      <Check className="erp-combobox-check" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
)
Combobox.displayName = "Combobox"

export { Combobox }
