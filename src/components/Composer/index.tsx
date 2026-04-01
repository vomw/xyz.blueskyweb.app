import {
  createContext,
  useCallback,
  useContext,
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
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import {useSift, type UseSiftReturn} from '@bsky.app/sift'
import {
  type TapperActiveFacet,
  type TapperFacet,
  type TapperSnapshot,
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
 * ─── Contexts ─────────────────────────────────────────────────────────────────
 */

type ComposerContextValue = {
  tapper: {
    on: ReturnType<typeof useTapper>['on']
    insert: ReturnType<typeof useTapper>['insert']
    input: ReturnType<typeof useTapper>['input']
    inputProps: ReturnType<typeof useTapper>['inputProps']
  }
  sift: UseSiftReturn
  inputScrollSharedValue: SharedValue<number>
  onRequestSubmit?: (request: SubmitRequest) => void
}

const ComposerContext = createContext<ComposerContextValue | null>(null)
ComposerContext.displayName = 'ComposerContext'

export function useComposerContext() {
  const ctx = useContext(ComposerContext)
  if (!ctx) {
    throw new Error('useComposerContext must be used within a Composer.Root')
  }
  return ctx
}

type ComposerStateContextValue = {
  state: TapperSnapshot
}

const ComposerStateContext = createContext<ComposerStateContextValue | null>(
  null,
)
ComposerStateContext.displayName = 'ComposerStateContext'

export function useComposerStateContext() {
  const ctx = useContext(ComposerStateContext)
  if (!ctx) {
    throw new Error(
      'useComposerStateContext must be used within a Composer.Root',
    )
  }
  return ctx
}

/*
 * ─── Root ─────────────────────────────────────────────────────────────────────
 */

export type RootProps = {
  children: React.ReactNode
  initialText?: string
  onChange?: (text: string) => void
  onActiveFacet?: (activeFacet: TapperActiveFacet | null) => void
  onFacetCommitted?: (facet: TapperFacet) => void
  onRequestSubmit?: (request: SubmitRequest) => void
  internalApiRef?: React.Ref<ComposerInternalApi>
}

export function Root({
  children,
  initialText,
  onChange: onChangeOuter,
  onActiveFacet: onActiveFacetOuter,
  onFacetCommitted: onFacetCommittedOuter,
  onRequestSubmit,
  internalApiRef,
}: RootProps) {
  const tapper = useTapper({
    initialText,
  })
  const sift = useSift({
    offset: a.p_sm.padding,
    placement: 'top-start',
    dynamicWidth: IS_WEB,
  })
  const inputScrollSharedValue = useSharedValue(0)

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
      callbackRefs.current.onActiveFacetOuter?.(facet)
    })
    const offFacetCommitted = tapper.on('facetCommitted', facet => {
      callbackRefs.current.onFacetCommittedOuter?.(facet)
    })
    return () => {
      offActiveFacet()
      offFacetCommitted()
    }
  }, [tapper.on])

  const composerCtx = useMemo<ComposerContextValue>(
    () => ({
      tapper: {
        on: tapper.on,
        insert: tapper.insert,
        input: tapper.input,
        inputProps: tapper.inputProps,
      },
      sift,
      inputScrollSharedValue,
      onRequestSubmit,
    }),
    [
      tapper.on,
      tapper.insert,
      tapper.input,
      tapper.inputProps,
      sift,
      inputScrollSharedValue,
      onRequestSubmit,
    ],
  )

  const stateCtx = useMemo<ComposerStateContextValue>(
    () => ({state: tapper.state}),
    [tapper.state],
  )

  return (
    <ComposerContext.Provider value={composerCtx}>
      <ComposerStateContext.Provider value={stateCtx}>
        {children}
      </ComposerStateContext.Provider>
    </ComposerContext.Provider>
  )
}

/*
 * ─── Input ────────────────────────────────────────────────────────────────────
 */

export type InputProps = Omit<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'onSelectionChange'
  | 'selection'
  | 'style'
  | 'onSubmitEditing'
> & {
  label: string
  ref?: React.Ref<TextInput>
  style?: ViewStyleProp['style']
  padding?: Parameters<typeof extractPadding>[0]
  textStyle?: TextStyleProp['style']
  initialNumberOfLines?: number
  maxNumberOfLines?: number
}

export function Input({
  label,
  placeholder,
  style,
  padding,
  textStyle: rawTextStyle,
  initialNumberOfLines = 1,
  maxNumberOfLines,
  ...rest
}: InputProps) {
  const {theme: t, fonts} = useAlf()
  const {tapper, sift, inputScrollSharedValue, onRequestSubmit} =
    useComposerContext()
  const {state} = useComposerStateContext()
  const textInputRef = useRef<TextInput>(null)

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

    return {textStyle: ts, textAreaStyle: tas, minHeight: mh, maxHeight: xh}
  }, [t, fonts, padding, rawTextStyle, initialNumberOfLines, maxNumberOfLines])

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
        sift.updatePosition()
      }
      return
    }

    textInputRef.current?.measure((_x, _y, _w, h) => {
      if (h !== prevHeight.current) {
        prevHeight.current = h
        sift.updatePosition()
      }
    })
  }, [state.text, minHeight, maxHeight, sift])

  const previewScrollStyle = useAnimatedStyle(() => ({
    transform: [{translateY: -inputScrollSharedValue.value}],
  }))

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

  const textContent = (
    <Text style={[textStyle, web({whiteSpace: 'pre-wrap'})]}>
      {state.nodes.map((node, i) => {
        switch (node.type) {
          case 'text':
            return <Span key={i}>{node.value}</Span>
          case 'trigger':
          case 'facet':
            return (
              <Span
                key={i}
                ref={IS_WEB ? sift.refs.setAnchor : undefined}
                style={node.type === 'facet' && {color: t.palette.primary_500}}>
                {node.raw}
              </Span>
            )
        }
      })}
    </Text>
  )

  return (
    <View style={[a.relative, style]}>
      {IS_WEB && (
        <View
          pointerEvents="none"
          style={[a.absolute, a.inset_0, a.z_10, {overflow: 'hidden'}]}>
          <Animated.View
            style={[
              padding,
              {position: 'absolute', left: 0, right: 0},
              previewScrollStyle,
            ]}>
            {textContent}
          </Animated.View>
        </View>
      )}
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
        value={undefined}
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
        }}>
        {IS_WEB ? null : textContent}
      </TextInput>
    </View>
  )
}

export function Autocomplete() {
  const {tapper, sift} = useComposerContext()
  const [activeFacet, setActiveFacet] = useState<TapperActiveFacet | null>(null)

  useEffect(() => {
    const off = tapper.on('activeFacet', facet => {
      setActiveFacet(facet)
    })
    return off
  }, [tapper.on])

  const updatePosition = useCallback(() => {
    sift.updatePosition()
  }, [sift])

  useOnKeyboard('keyboardDidShow', updatePosition)
  useOnKeyboard('keyboardDidHide', updatePosition)

  if (!activeFacet) return null

  return (
    <AutocompleteInner
      sift={sift}
      activeFacet={activeFacet}
      onDismiss={() => setActiveFacet(null)}
    />
  )
}

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

  return data ? (
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
      }}
      onDismiss={onDismiss}
    />
  ) : null
}
