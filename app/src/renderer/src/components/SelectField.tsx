import type { SelectHTMLAttributes } from 'react'

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  shellClassName?: string
}

/**
 * StyledSelect — wraps a native <select> with a product-grade shell.
 * Adds a custom chevron so the browser-native arrow is gone everywhere.
 * Pass shellClassName to control the wrapper element's class.
 */
export default function SelectField({ shellClassName, className, children, ...props }: SelectFieldProps) {
  return (
    <div className={`selectShell${shellClassName ? ` ${shellClassName}` : ''}`}>
      <select className={className} {...props}>
        {children}
      </select>
      <svg className="selectChevron" viewBox="0 0 10 6" aria-hidden="true" fill="none">
        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
