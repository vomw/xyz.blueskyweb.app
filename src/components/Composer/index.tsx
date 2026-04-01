import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  TextInput,
  type TextInputProps,
  type TextInputSubmitEditingEvent,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import {useSift, type UseSiftReturn} from '@bsky.app/sift'
import {
  type TapperActiveFacet,
  type TapperFacet,
  useTapper,
} from '@bsky.app/tapper'

import {HITSLOP_10} from '#/lib/constants'
import {mergeRefs} from '#/lib/merge-refs'
import {
  atoms as a,
  extractPadding,
  type TextStyleProp,
  useAlf,
  type ViewStyleProp,
  web,
} from '#/alf'
import {normalizeTextStyles} from '#/alf/typography'
import {
  Autocomplete as AutocompleteBase,
  AutocompleteItemProfile,
  parseAutocompleteItemType,
  useAutocomplete,
} from '#/components/Autocomplete'
import {useOnKeyboard} from '#/components/hooks/useOnKeyboard'
import {Span, Text} from '#/components/Typography'
import {IS_WEB, IS_WEB_TOUCH_DEVICE} from '#/env'

/*
 * ─── Types ────────────────────────────────────────────────────────────────────
 */

export type SubmitRequest =
  | {
      platform: 'web'
      shiftKey: boolean
      metaKey: boolean
      nativeEvent: KeyboardEvent
    }
  | {
      platform: 'native'
      nativeEvent: TextInputSubmitEditingEvent
    }

/**
 * Bail-out API for special cases where a parent component needs to
 * imperatively control the Composer (e.g. clearing the input on submit).
 * Prefer props/callbacks for normal data flow.
 */
export type ComposerInternalApi = {
  input?: ReturnType<typeof useTapper>['input']
  clear: () => void
  insert(text: string): void
}

export function useComposerInternalApiRef() {
  return useRef<ComposerInternalApi>(null)
}

/*
 * ─── Composer ─────────────────────────────────────────────────────────────────
 */

export type ComposerProps = Omit<
  TextInputProps,
  | 'value'
  | 'onChange'
  | 'onChangeText'
  | 'onSelectionChange'
  | 'selection'
  | 'style'
  | 'onSubmitEditing'
> & {
  children?: React.ReactNode
  label: string
  ref?: React.Ref<TextInput>
  style?: ViewStyleProp['style']
  padding?: Parameters<typeof extractPadding>[0]
  textStyle?: TextStyleProp['style']
  initialNumberOfLines?: number
  maxNumberOfLines?: number
  initialText?: string
  onChange?: (text: string) => void
  onActiveFacet?: (activeFacet: TapperActiveFacet | null) => void
  onFacetCommitted?: (facet: TapperFacet) => void
  onRequestSubmit?: (request: SubmitRequest) => void
  internalApiRef?: React.Ref<ComposerInternalApi>
}

export function Composer({
  children,
  label,
  placeholder,
  style,
  padding,
  textStyle: rawTextStyle,
  initialNumberOfLines = 1,
  maxNumberOfLines,
  initialText,
  onChange: onChangeOuter,
  onActiveFacet: onActiveFacetOuter,
  onFacetCommitted: onFacetCommittedOuter,
  onRequestSubmit,
  internalApiRef,
  ...rest
}: ComposerProps) {
  const {theme: t, fonts} = useAlf()
  const textInputRef = useRef<TextInput>(null)

  const tapper = useTapper({initialText})
  const sift = useSift({
    offset: a.p_sm.padding,
    placement: 'top-start',
    dynamicWidth: IS_WEB,
  })
  const inputScrollSharedValue = useSharedValue(0)
  const [activeFacet, setActiveFacet] = useState<TapperActiveFacet | null>(null)

  const callbackRefs = useRef({
    onActiveFacetOuter,
    onFacetCommittedOuter,
  })
  callbackRefs.current = {
    onActiveFacetOuter,
    onFacetCommittedOuter,
  }

  useImperativeHandle(
    internalApiRef,
    () => ({
      input: tapper.input,
      clear: () => {
        tapper.inputProps.onChangeText('')
        inputScrollSharedValue.value = 0
      },
      insert: tapper.insert,
    }),
    [tapper.input, tapper.insert, inputScrollSharedValue],
  )

  /*
   * Skip the initial mount to avoid an unnecessary re-render — the parent
   * already knows the initial value since it passed `initialText`.
   */
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    onChangeOuter?.(tapper.state.text)
  }, [tapper.state.text, onChangeOuter])

  useEffect(() => {
    const offActiveFacet = tapper.on('activeFacet', facet => {
      setActiveFacet(facet)
      callbackRefs.current.onActiveFacetOuter?.(facet)
    })
    const offFacetCommitted = tapper.on('facetCommitted', facet => {
      callbackRefs.current.onFacetCommittedOuter?.(facet)
    })
    const offAfterInsert = tapper.on('afterInsert', () => {
      tapper.input.focus()
    })
    return () => {
      offActiveFacet()
      offFacetCommitted()
      offAfterInsert()
    }
  }, [tapper.on, tapper.input])

  // ─── Text style computation ───────────────────────────────────────────

  const {textStyle, textAreaStyle, minHeight, maxHeight} = useMemo(() => {
    const ts = normalizeTextStyles(
      [a.leading_snug, rawTextStyle, t.atoms.text],
      {
        fontScale: fonts.scaleMultiplier,
        fontFamily: fonts.family,
        flags: {},
      },
    )
    const p = padding
      ? extractPadding(padding)
      : {paddingTop: 0, paddingBottom: 0}
    const lineHeight = ts.lineHeight || 20
    const verticalSpace = p.paddingTop + p.paddingBottom
    const mh = lineHeight * initialNumberOfLines + verticalSpace
    const xh = maxNumberOfLines
      ? lineHeight * maxNumberOfLines + verticalSpace
      : 999
    const tas = IS_WEB
      ? {height: lineHeight + verticalSpace}
      : {minHeight: mh, maxHeight: xh}

    if (!IS_WEB) {
      delete ts.lineHeight
    }

    return {textStyle: ts, textAreaStyle: tas, minHeight: mh, maxHeight: xh}
  }, [t, fonts, padding, rawTextStyle, initialNumberOfLines, maxNumberOfLines])

  // ─── Height auto-resize + sift positioning ────────────────────────────

  const updateAutocompletePosition = useCallback(() => {
    sift.updatePosition()
  }, [sift])

  useOnKeyboard('keyboardDidShow', updateAutocompletePosition)
  useOnKeyboard('keyboardDidHide', updateAutocompletePosition)

  const prevHeight = useRef(0)
  useEffect(() => {
    if (IS_WEB) {
      const el = textInputRef.current as unknown as HTMLTextAreaElement
      if (!el) return
      el.style.height = '0px'
      const scrollHeight = el.scrollHeight
      const nextHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
      el.style.height = `${nextHeight}px`
      el.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'
      if (nextHeight !== prevHeight.current) {
        prevHeight.current = nextHeight
        updateAutocompletePosition()
      }
      return
    }

    textInputRef.current?.measure((_x, _y, _w, h) => {
      if (h !== prevHeight.current) {
        prevHeight.current = h
        updateAutocompletePosition()
      }
    })
  }, [tapper.state.text, minHeight, maxHeight, updateAutocompletePosition])

  // ─── Scroll sync ──────────────────────────────────────────────────────

  const previewScrollStyle = useAnimatedStyle(() => ({
    transform: [{translateY: -inputScrollSharedValue.value}],
  }))

  // ─── Web keyboard handling ────────────────────────────────────────────

  const isComposing = useRef(false)
  const onKeyPressWeb = useCallback(
    (e: React.KeyboardEvent | any) => {
      if (IS_WEB_TOUCH_DEVICE) return
      if (isComposing.current) return

      /*
       * On Safari, the final keydown to dismiss an IME is also "Enter" with
       * keyCode 229. Chrome/Firefox don't have this problem.
       *
       * @see https://github.com/bluesky-social/social-app/issues/4178
       */
      if (e.key === 'Enter' && e.keyCode === 229) return

      if (e.key === 'Enter') {
        onRequestSubmit?.({
          platform: 'web',
          shiftKey: e.shiftKey,
          metaKey: e.metaKey,
          nativeEvent: e.nativeEvent,
        })
      }
    },
    [onRequestSubmit],
  )

  return (
    <>
      <View style={[a.relative, style]}>
        <View
          pointerEvents="none"
          style={[a.absolute, a.inset_0, a.z_10, {overflow: 'hidden'}]}>
          <Animated.View
            style={[
              padding,
              {position: 'absolute', left: 0, right: 0},
              previewScrollStyle,
            ]}>
            <Text style={[textStyle, web({whiteSpace: 'pre-wrap'})]}>
              {tapper.state.nodes.map((node, i) => {
                switch (node.type) {
                  case 'text':
                    return <Span key={i}>{node.value}</Span>
                  case 'trigger':
                  case 'facet':
                    return (
                      <Span
                        key={i}
                        ref={IS_WEB ? sift.refs.setAnchor : undefined}
                        style={
                          node.type === 'facet' && {
                            color: t.palette.primary_500,
                          }
                        }>
                        {node.raw}
                      </Span>
                    )
                }
              })}
            </Text>
          </Animated.View>
        </View>
        <TextInput
          dirName="ltr"
          autoCapitalize="none"
          autoCorrect={false}
          multiline={true}
          hitSlop={HITSLOP_10}
          placeholder={placeholder}
          placeholderTextColor={t.palette.contrast_500}
          accessibilityLabel={label}
          accessibilityHint={label}
          keyboardAppearance={t.scheme}
          submitBehavior="newline"
          onSubmitEditing={e => {
            onRequestSubmit?.({platform: 'native', nativeEvent: e})
          }}
          style={[
            textStyle,
            padding,
            a.relative,
            a.z_20,
            a.border_0,
            {
              color: 'transparent',
              background: 'transparent',
              textAlignVertical: 'top',
              includeFontPadding: false,
            },
            textAreaStyle,
            web({
              resize: 'none',
              outline: 'none',
              caretColor: textStyle.color ?? 'black',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overscrollBehavior: 'none',
              ...textAreaStyle,
            }),
          ]}
          {...rest}
          {...tapper.inputProps}
          {...sift.targetProps}
          ref={mergeRefs([
            textInputRef,
            rest.ref,
            tapper.inputProps.ref,
            sift.targetProps.ref,
          ])}
          onBlur={e => {
            rest.onBlur?.(e)
          }}
          onKeyPress={IS_WEB ? onKeyPressWeb : undefined}
          onScroll={e => {
            if (IS_WEB) {
              inputScrollSharedValue.value = (e.target as any).scrollTop
            } else {
              inputScrollSharedValue.value = e.nativeEvent.contentOffset.y
            }
          }}
          // @ts-ignore web only
          onCompositionStart={() => {
            isComposing.current = true
          }}
          // @ts-ignore web only
          onCompositionEnd={() => {
            isComposing.current = false
          }}
        />

        {children}
      </View>

      {activeFacet && (
        <AutocompleteInner
          sift={sift}
          activeFacet={activeFacet}
          onDismiss={() => setActiveFacet(null)}
        />
      )}
    </>
  )
}

/*
 * ─── Autocomplete (private) ───────────────────────────────────────────────────
 */

function AutocompleteInner({
  sift,
  activeFacet,
  onDismiss,
}: {
  sift: UseSiftReturn
  activeFacet: TapperActiveFacet
  onDismiss: () => void
}) {
  const {data} = useAutocomplete({
    type: parseAutocompleteItemType(activeFacet.type),
    query: activeFacet.value,
  })

  const updatePosition = useCallback(() => {
    sift.updatePosition()
  }, [sift])

  useOnKeyboard('keyboardDidShow', updatePosition)
  useOnKeyboard('keyboardDidHide', updatePosition)

  return data && data.length ? (
    <AutocompleteBase
      sift={sift}
      data={data}
      render={props => {
        if (props.item.type === 'profile') {
          return <AutocompleteItemProfile {...props} />
        }
        return <View />
      }}
      onSelect={item => {
        activeFacet.replace(item.value)
        onDismiss()
      }}
      onDismiss={onDismiss}
    />
  ) : null
}
