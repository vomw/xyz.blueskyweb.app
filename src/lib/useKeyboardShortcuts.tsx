import {useHotkeys} from 'react-hotkeys-hook'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {useDialogStateContext} from '#/state/dialogs'
import {emitFocusSearch} from '#/state/events'
import {useLightbox} from '#/state/lightbox'
import {useModals} from '#/state/modals'
import {useSession} from '#/state/session'
import {useIsDrawerOpen} from '#/state/shell/drawer-open'

enum Hotkeys {
  OPEN_COMPOSER = 'n',
  FOCUS_SEARCH = 'slash',
}

export function useKeyboardShortcuts() {
  const {openComposer} = useOpenComposer()
  const {openDialogs} = useDialogStateContext()
  const {isModalActive} = useModals()
  const {activeLightbox} = useLightbox()
  const isDrawerOpen = useIsDrawerOpen()
  const {hasSession} = useSession()

  const shouldIgnore = (requiresSession?: boolean) => {
    if (requiresSession && !hasSession) {
      return true
    }

    if (
      openDialogs?.current.size > 0 ||
      isModalActive ||
      activeLightbox ||
      isDrawerOpen
    ) {
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
    {scopes: ['composer']},
  )

  useHotkeys(Hotkeys.FOCUS_SEARCH, () => handleKey(emitFocusSearch), {
    scopes: ['search'],
    preventDefault: true,
  })
}
