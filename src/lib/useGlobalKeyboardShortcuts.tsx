import {useLingui} from '@lingui/react/macro'
import {useHotkeys} from 'react-hotkeys-hook'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {emitFocusSearch} from '#/state/events'
import {useSession} from '#/state/session'

enum Hotkeys {
  OPEN_COMPOSER = 'n',
  FOCUS_SEARCH = 'slash',
}

export function useGlobalKeyboardShortcuts() {
  const {openComposer} = useOpenComposer()
  const {hasSession} = useSession()
  const {t: l} = useLingui()

  const shouldIgnore = (requiresSession?: boolean) => {
    if (requiresSession && !hasSession) {
      return true
    }

    return false
  }

  const handleKey = (
    callback: () => void,
    options?: {requiresSession?: boolean},
  ) => {
    if (shouldIgnore(options?.requiresSession)) {
      return
    }
    callback()
  }

  useHotkeys(
    Hotkeys.OPEN_COMPOSER,
    () =>
      handleKey(
        () => {
          openComposer({logContext: 'Other'})
        },
        {
          requiresSession: true,
        },
      ),
    {scopes: ['global'], description: l`Compose new post`},
    [openComposer],
  )

  useHotkeys(Hotkeys.FOCUS_SEARCH, () => handleKey(emitFocusSearch), {
    scopes: ['global'],
    preventDefault: true,
    description: l`Focus the search field`,
  })
}
