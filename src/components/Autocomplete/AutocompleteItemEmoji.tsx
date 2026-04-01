import {SiftItem} from '@bsky.app/sift'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {type AutocompleteItemProps} from './types'

export function AutocompleteItemEmoji({
  active,
  props,
  item,
}: AutocompleteItemProps) {
  const t = useTheme()
  const moderationOpts = useModerationOpts()

  if (item.type !== 'emoji' || !moderationOpts) return null

  return (
    <SiftItem
      {...props}
      style={s => [
        a.px_md,
        a.py_sm,
        active || s.hovered || s.pressed ? [t.atoms.bg_contrast_25] : [],
      ]}>
      <Text>{item.value}</Text>
    </SiftItem>
  )
}
