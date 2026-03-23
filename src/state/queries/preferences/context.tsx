import {createContext, useContext} from 'react'
import {ActivityIndicator, View} from 'react-native'

import {
  usePreferencesQuery,
  type UsePreferencesQueryResponse,
} from '#/state/queries/preferences'
import {atoms as a} from '#/alf'

const PreferencesContext = createContext<UsePreferencesQueryResponse | null>(
  null,
)
PreferencesContext.displayName = 'PreferencesContext'

export function Provider({children}: {children: React.ReactNode}) {
  const {data} = usePreferencesQuery()

  if (!data) {
    return null
  }

  return <PreferencesContext value={data}>{children}</PreferencesContext>
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider')
  }
  return context
}
