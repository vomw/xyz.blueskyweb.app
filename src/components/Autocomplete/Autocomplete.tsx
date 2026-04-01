import {useCallback} from 'react'
import {Sift, type UseSiftReturn} from '@bsky.app/sift'

import {atoms as a, useTheme} from '#/alf'
import {type AutocompleteItem} from '#/components/Autocomplete/types'
import {useOnKeyboard} from '#/components/hooks/useOnKeyboard'
import {Portal} from '#/components/Portal'
import {IS_WEB} from '#/env'

export function Autocomplete({
  sift,
  data,
  render,
  onSelect,
  onDismiss,
}: {
  sift: UseSiftReturn
  data: AutocompleteItem[]
  render: Parameters<typeof Sift<AutocompleteItem>>[0]['render']
  onSelect: (item: AutocompleteItem) => void
  onDismiss: () => void
}) {
  const t = useTheme()

  const updatePosition = useCallback(() => {
    sift.updatePosition()
  }, [sift])

  useOnKeyboard('keyboardDidShow', updatePosition)
  useOnKeyboard('keyboardDidHide', updatePosition)

  return (
    <Portal>
      <Sift
        inverted={!IS_WEB}
        sift={sift}
        data={data}
        onSelect={onSelect}
        onDismiss={onDismiss}
        style={[
          a.overflow_hidden,
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_low,
          t.atoms.bg,
          !IS_WEB && a.w_full,
        ]}
        render={render}
      />
    </Portal>
  )
}
