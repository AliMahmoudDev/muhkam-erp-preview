---
name: TopReportsTab generic table renderer any-retention
description: Why any[] is retained in TopTable component props
---

**Rule:**  
`TopReportsTab.tsx` `TopTable` component intentionally uses `rows:any[]` and `cols:{fmt?:(v:any)=>string}`. Do not replace with `Record<string,unknown>[]`.

**Why:**  
`row[c.key]` is rendered as ReactNode inline AND passed to `formatCurrency(v)` which accepts `number | null | undefined`. The union `string|number|null` and `unknown` both fail one of those constraints. The component is a generic table renderer where dynamic key access makes precise typing impractical without generics refactor.

**How to apply:**  
Leave the eslint-disable-next-line comment in place. If proper typing is desired later, refactor with `TopTable<T extends Record<string,number|null>>(...)`.
