import {memo, useCallback, useState} from 'react'
import {
  ActivityIndicator,
  type StyleProp,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {StackActions, useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useActorAutocompleteQuery} from '#/state/queries/actor-autocomplete'
import {SearchProfileCard} from '#/screens/Search/components/SearchProfileCard'
import {atoms as a, useTheme} from '#/alf'
import {SearchInput} from '#/components/forms/SearchInput'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'

const WHITESPACE_RE = /\s+/gu

let SearchLinkCard = ({
  label,
  to,
  onPress,
  style,
}: {
  label: string
  to?: string
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}): React.ReactNode => {
  const t = useTheme()

  const inner = (
    <View style={[a.py_lg, a.px_md, t.atoms.border_contrast_low, style]}>
      <Text style={[a.text_md, t.atoms.text]}>{label}</Text>
    </View>
  )

  if (onPress || !to) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityLabel={label}
        accessibilityHint="">
        {inner}
      </TouchableOpacity>
    )
  }

  return (
    <Link
      label={label}
      to={to}
      style={[a.py_lg, a.px_md, t.atoms.border_contrast_low, style]}>
      <Text style={[a.text_md, t.atoms.text]}>{label}</Text>
    </Link>
  )
}
SearchLinkCard = memo(SearchLinkCard)
export {SearchLinkCard}

export function DesktopSearch() {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const [isActive, setIsActive] = useState<boolean>(false)
  const [query, setQuery] = useState<string>('')
  const {data: autocompleteData, isFetching} = useActorAutocompleteQuery(
    query,
    true,
  )
  const tQuery = query.replace(WHITESPACE_RE, ' ').trim()

  const moderationOpts = useModerationOpts()

  const onChangeText = useCallback((text: string) => {
    setQuery(text)
    setIsActive(text.length > 0)
  }, [])

  const onPressCancelSearch = useCallback(() => {
    setQuery('')
    setIsActive(false)
  }, [setQuery])

  const onSubmit = useCallback(() => {
    setIsActive(false)
    if (!tQuery.length) return
    navigation.dispatch(StackActions.push('Search', {q: tQuery}))
  }, [tQuery, navigation])

  const onSearchProfileCardPress = useCallback(() => {
    setQuery('')
    setIsActive(false)
  }, [])

  return (
    <View style={[a.relative, a.w_full, t.atoms.bg, {zIndex: 1}]}>
      <SearchInput
        value={query}
        onChangeText={onChangeText}
        onClearText={onPressCancelSearch}
        onSubmitEditing={onSubmit}
      />
      {tQuery !== '' && isActive && moderationOpts && (
        <View
          style={[
            a.mt_sm,
            a.flex_col,
            a.w_full,
            a.border,
            a.rounded_sm,
            t.atoms.bg,
            t.atoms.border_contrast_low,
            {
              overflow: 'hidden',
              position: 'absolute',
              top: '100%',
            },
          ]}>
          {isFetching && !autocompleteData?.length ? (
            <View style={[a.p_sm]}>
              <ActivityIndicator />
            </View>
          ) : (
            <>
              <SearchLinkCard
                label={l`Search for “${tQuery}”`}
                to={`/search?q=${encodeURIComponent(tQuery)}`}
                style={
                  (autocompleteData?.length ?? 0) > 0 ? a.border_b : undefined
                }
              />
              {autocompleteData?.map(item => (
                <SearchProfileCard
                  key={item.did}
                  profile={item}
                  moderationOpts={moderationOpts}
                  onPress={onSearchProfileCardPress}
                />
              ))}
            </>
          )}
        </View>
      )}
    </View>
  )
}
