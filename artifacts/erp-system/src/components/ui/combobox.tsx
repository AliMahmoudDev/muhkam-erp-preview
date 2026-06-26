"use client"

import * as React from "react"
import * as ReactDOM from "react-dom"
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
  popupWidth?: "trigger" | "content" | "auto"
  maxPanelHeight?: number
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end" | "auto"
}

const PORTAL_Z = 9999

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
      popupWidth = "trigger",
      maxPanelHeight = 280,
      placement = "auto",
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [panelStyle, setPanelStyle] = React.useState<React.CSSProperties>({})
    const [openUpward, setOpenUpward] = React.useState(false)

    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const searchRef = React.useRef<HTMLInputElement>(null)
    const panelRef = React.useRef<HTMLDivElement>(null)

    React.useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement)

    const selected = options.find((o) => o.value === value)

    const filtered =
      searchable && query
        ? options.filter((o) =>
            o.label.toLowerCase().includes(query.toLowerCase())
          )
        : options

    const calcPosition = React.useCallback(() => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const vH = window.innerHeight
      const vW = window.innerWidth
      const GAP = 6
      const EDGE = 8

      const spaceBelow = vH - rect.bottom - EDGE
      const spaceAbove = rect.top - EDGE

      let goUp = false
      if (placement === "auto") {
        goUp = spaceBelow < 160 && spaceAbove > spaceBelow
      } else {
        goUp = placement.startsWith("top")
      }
      setOpenUpward(goUp)

      const availH = Math.max(
        80,
        goUp
          ? Math.min(maxPanelHeight, spaceAbove)
          : Math.min(maxPanelHeight, spaceBelow)
      )

      const triggerW = rect.width
      const wPx = popupWidth === "trigger" ? triggerW : undefined
      const minW = wPx ?? Math.min(triggerW, 180)

      const isEndAligned =
        placement === "bottom-end" || placement === "top-end"
      let leftPx = isEndAligned ? rect.right - (wPx ?? minW) : rect.left
      leftPx = Math.max(EDGE, Math.min(leftPx, vW - minW - EDGE))

      const style: React.CSSProperties = {
        position: "fixed",
        zIndex: PORTAL_Z,
        left: leftPx,
        width: wPx,
        minWidth: minW,
        maxHeight: availH,
      }
      if (goUp) {
        style.bottom = vH - rect.top + GAP
      } else {
        style.top = rect.bottom + GAP
      }
      setPanelStyle(style)
    }, [placement, popupWidth, maxPanelHeight])

    React.useEffect(() => {
      if (open) {
        calcPosition()
        if (searchable) setTimeout(() => searchRef.current?.focus(), 10)
      } else {
        setQuery("")
      }
    }, [open, searchable, calcPosition])

    React.useEffect(() => {
      if (!open) return
      const update = () => calcPosition()
      window.addEventListener("scroll", update, true)
      window.addEventListener("resize", update)
      return () => {
        window.removeEventListener("scroll", update, true)
        window.removeEventListener("resize", update)
      }
    }, [open, calcPosition])

    React.useEffect(() => {
      if (!open) return
      const handlePointerDown = (e: PointerEvent) => {
        if (
          !triggerRef.current?.contains(e.target as Node) &&
          !panelRef.current?.contains(e.target as Node)
        ) {
          setOpen(false)
        }
      }
      document.addEventListener("pointerdown", handlePointerDown)
      return () => document.removeEventListener("pointerdown", handlePointerDown)
    }, [open])

    const handleSelect = (opt: ComboboxOption) => {
      if (opt.disabled) return
      onChange?.(opt.value)
      setOpen(false)
    }

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange?.("")
      setOpen(false)
    }

    const panel = open
      ? ReactDOM.createPortal(
          <div
            ref={panelRef}
            className={cn(
              "erp-combobox-panel",
              !searchable && "erp-combobox-panel--compact",
              openUpward && "erp-combobox-panel--upward"
            )}
            role="listbox"
            style={panelStyle}
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
                <div
                  className={cn(
                    "erp-combobox-empty",
                    !searchable && "erp-combobox-empty--compact"
                  )}
                >
                  {emptyText}
                </div>
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
          </div>,
          document.body
        )
      : null

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
          <span
            className={cn(
              "erp-combobox-value",
              !selected && "erp-combobox-placeholder"
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <span className="erp-combobox-icons">
            {clearable && selected && (
              <span
                role="button"
                aria-label="مسح"
                className="erp-combobox-clear"
                onClick={handleClear}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  handleClear(e as unknown as React.MouseEvent)
                }
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
        {panel}
      </div>
    )
  }
)
Combobox.displayName = "Combobox"

export { Combobox }
