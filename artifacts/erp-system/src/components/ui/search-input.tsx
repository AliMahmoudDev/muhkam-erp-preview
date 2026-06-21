import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onChange, onClear, ...props }, ref) => {
    const hasValue = Boolean(value)

    return (
      <div className="erp-search-input-wrap">
        <span className="erp-search-input-icon" aria-hidden="true">
          <Search />
        </span>
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={onChange}
          className={cn("erp-search-input", className)}
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            className="erp-search-input-clear"
            onClick={onClear}
            aria-label="مسح البحث"
            tabIndex={-1}
          >
            <X />
          </button>
        )}
      </div>
    )
  }
)
SearchInput.displayName = "SearchInput"

export { SearchInput }
