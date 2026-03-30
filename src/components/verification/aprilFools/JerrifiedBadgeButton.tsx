import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {UnverifiedX} from '#/components/icons/UnverifiedX'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import type * as bsky from '#/types/bsky'
import {JerrifiedBadge} from './JerrifiedBadge'

export function JerrifiedBadgeButton({
  profile,
  width,
}: {
  profile: bsky.profile.AnyProfileView
  width: number
}) {
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const control = Dialog.useDialogControl()

  return (
    <>
      <Button
        label={l`Unverified account`}
        hitSlop={20}
        onPress={evt => {
          evt.preventDefault()
          control.open()
        }}>
        {({hovered}) => (
          <View
            style={[
              a.justify_end,
              a.align_end,
              a.transition_transform,
              {
                width: width,
                height: width,
                transform: [{scale: hovered ? 1.1 : 1}],
              },
            ]}>
            <UnverifiedX width={width} />
          </View>
        )}
      </Button>
      <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
        <Dialog.Handle />
        <Dialog.ScrollableInner
          label={l`Unverified account`}
          style={web({maxWidth: 350})}
          contentContainerStyle={a.gap_sm}>
          <View
            style={[
              a.w_full,
              a.py_lg,
              a.align_center,
              a.flex_row,
              a.justify_center,
            ]}>
            <UserAvatar
              avatar={profile.avatar}
              type="user"
              size={60}
              noBorder
            />
            <View style={[{opacity: 0.5}, a.absolute, a.z_10]}>
              <JerrifiedBadge width={64} />
            </View>
          </View>
          <Text style={[a.text_2xl, a.font_semi_bold, a.leading_snug]}>
            <Trans>Jerry is unverified</Trans>
          </Text>
          <Text style={[a.text_md, a.leading_snug]}>
            <Trans>Do not trust this user under any circumstances.</Trans>
          </Text>
          <Button
            size="small"
            color="primary"
            onPress={() => {
              ax.metric('jerry:no', {})
              control.close()
            }}
            label={l`Jerry, no!`}
            style={[a.mt_sm]}>
            <ButtonText>
              <Trans>Jerry, no!</Trans>
            </ButtonText>
          </Button>
          <Button
            size="small"
            color="secondary"
            onPress={() => control.close()}
            label={l`Close`}>
            <ButtonText>
              <Trans>Close</Trans>
            </ButtonText>
          </Button>
          <Dialog.Close />
        </Dialog.ScrollableInner>
      </Dialog.Outer>
    </>
  )
}
