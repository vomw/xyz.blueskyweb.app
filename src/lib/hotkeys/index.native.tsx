import React from 'react'

export function Provider({children}: React.PropsWithChildren<unknown>) {
  return <>{children}</>
}

export function useHotkeysContext() {
  return {
    enableScope: () => {},
    disableScope: () => {},
  }
}
