import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Pressable,
  TextInput,
  type TextInputProps,
  type TextInputSubmitEditingEvent,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import {Sift, SiftItem, useSift} from '@bsky.app/sift'
import {
  type TapperActiveFacet,
  type TapperFacet,
  useTapper,
} from '@bsky.app/tapper'
import {useLingui} from '@lingui/react/macro'
import {countGraphemes} from 'unicode-segmenter/grapheme'

import {HITSLOP_10, MAX_DM_GRAPHEME_LENGTH} from '#/lib/constants'
import {useHaptics} from '#/lib/haptics'
import {mergeRefs} from '#/lib/merge-refs'
import {isBskyPostUrl} from '#/lib/strings/url-helpers'
import {useEmail} from '#/state/email-verification'
import {
  useMessageDraft,
  useSaveMessageDraft,
} from '#/state/messages/message-drafts'
import {textInputWebEmitter} from '#/view/com/composer/text-input/textInputWebEmitter'
import {
  type Emoji,
  EmojiPicker,
  type EmojiPickerState,
} from '#/view/com/composer/text-input/web/EmojiPicker'
import {
  atoms as a,
  extractPadding,
  type TextStyleProp,
  useAlf,
  useTheme,
  type ViewStyleProp,
  web,
} from '#/alf'
import {normalizeTextStyles} from '#/alf/typography'
import {useInteractionState} from '#/components/hooks/useInteractionState'
import {useOnKeyboard} from '#/components/hooks/useOnKeyboard'
import {EmojiArc_Stroke2_Corner0_Rounded as EmojiSmile} from '#/components/icons/Emoji'
import {PaperPlane_Stroke2_Corner0_Rounded as PaperPlane} from '#/components/icons/PaperPlane'
import {Portal} from '#/components/Portal'
import * as Toast from '#/components/Toast'
import {Span, Text} from '#/components/Typography'
import {IS_WEB, IS_WEB_TOUCH_DEVICE} from '#/env'

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

export type ComposerProps = Omit<
  TextInputProps,
  'value' | 'onSelectionChange' | 'selection' | 'style' | 'onSubmitEditing'
> & {
  /**
   * Required a11y label, used for accessibilityHint as well unless that prop is specified.
   */
  label: string
  /**
   * Optional forwarded ref.
   */
  ref?: React.Ref<TextInput>
  /**
   * Styles applied to the input container. To style the text, use the
   * `textStyle` prop.
   */
  style?: ViewStyleProp['style']
  /**
   * Padding applied to the `TextInput` and the facet preview container.
   */
  padding?: Parameters<typeof extractPadding>[0]
  /**
   * Shared text style applied to both the preview overlay and the input.
   * Must match exactly for pixel-perfect alignment.
   */
  textStyle?: TextStyleProp['style']
  /**
   * Sets a default height on the input, but still allows for expansion
   */
  initialNumberOfLines?: number
  /**
   * Sets the max height on the input
   */
  maxNumberOfLines?: number
  /**
   * When a facet is active (e.g. the user is typing after a trigger), this callbacks is called with the active facet info. When the facet is committed (e.g. the user selects an autocomplete suggestion or finishes typing), the `onFacetCommitted` callback is called with the committed facet info.
   */
  onActiveFacet?: (activeFacet: TapperActiveFacet | null) => void
  /**
   * Called when a facet is committed, either by selecting an autocomplete suggestion or by finishing typing. The committed facet info is passed as an argument.
   */
  onFacetCommitted?: (facet: TapperFacet) => void
  /**
   * Called when the user presses Enter on web. Includes modifier key state
   * and the native event for calling `preventDefault()`. On native, fired
   * from a submit button press.
   */
  onRequestSubmit?: (request: SubmitRequest) => void
  /**
   * Ref to the internal imperative API. See {@link ComposerInternalApi}.
   */
  internalApiRef?: React.Ref<ComposerInternalApi>
}

function Composer({
  children,
  label,
  placeholder,
  defaultValue,
  style,
  padding,
  textStyle: rawTextStyle,
  initialNumberOfLines = 1,
  maxNumberOfLines,
  onChangeText: onChangeTextOuter,
  onActiveFacet: onActiveFacetOuter,
  onFacetCommitted: onFacetCommittedOuter,
  internalApiRef,
  onRequestSubmit,
  ...rest
}: ComposerProps) {
  const {theme: t, fonts} = useAlf()
  const textInputRef = useRef<TextInput>(null)
  const tapper = useTapper({
    initialText: defaultValue,
  })
  const callbackRefs = useRef({
    onActiveFacetOuter,
    onFacetCommittedOuter,
  })
  callbackRefs.current = {
    onActiveFacetOuter,
    onFacetCommittedOuter,
  }
  const scrollY = useSharedValue(0)

  useImperativeHandle(
    internalApiRef,
    () => ({
      input: tapper.input,
      clear: () => {
        tapper.inputProps.onChangeText('')
        scrollY.value = 0
      },
      insert: tapper.insert,
    }),
    [tapper.inputProps, tapper.input, tapper.insert, scrollY],
  )

  const [activeFacet, setActiveFacet] = useState<TapperActiveFacet | null>(null)
  const sift = useSift({
    offset: a.p_sm.padding,
    placement: 'top-start',
    dynamicWidth: IS_WEB,
  })

  /*
   * Skip the initial mount to avoid an unnecessary re-render — the parent
   * already knows the initial value since it passed `defaultValue`.
   */
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    onChangeTextOuter?.(tapper.state.text)
  }, [tapper.state.text, onChangeTextOuter])

  useEffect(() => {
    const offActiveFacet = tapper.on('activeFacet', activeFacet => {
      setActiveFacet(activeFacet)
      callbackRefs.current.onActiveFacetOuter?.(activeFacet)
    })
    const offFacetCommitted = tapper.on('facetCommitted', facet => {
      callbackRefs.current.onFacetCommittedOuter?.(facet)
    })
    return () => {
      offActiveFacet()
      offFacetCommitted()
    }
  }, [])

  const {textStyle, textAreaStyle, minHeight, maxHeight} = useMemo(() => {
    const textStyle = normalizeTextStyles(
      [a.leading_snug, rawTextStyle, t.atoms.text],
      {
        fontScale: fonts.scaleMultiplier,
        fontFamily: fonts.family,
        flags: {},
      },
    )
    const p = padding
      ? extractPadding(padding)
      : {
          paddingTop: 0,
          paddingBottom: 0,
        }
    const lineHeight = textStyle.lineHeight || 20
    const verticalSpace = p.paddingTop + p.paddingBottom
    const minHeight = lineHeight * initialNumberOfLines + verticalSpace
    const maxHeight = maxNumberOfLines
      ? lineHeight * maxNumberOfLines + verticalSpace
      : 999
    const textAreaStyle = IS_WEB
      ? {
          height: (textStyle.lineHeight || 20) + p.paddingTop + p.paddingBottom,
        }
      : {minHeight, maxHeight}

    /*
     * On iOS especially, TextInput and Text line height does not render the
     * same way, but setting this to undefined and using the default font
     * metrics works fine.
     */
    if (!IS_WEB) {
      // disabled for now to eval the text as children
      // delete textStyle.lineHeight
    }

    return {
      textStyle,
      textAreaStyle,
      minHeight,
      maxHeight,
    }
  }, [t, fonts, padding, rawTextStyle, initialNumberOfLines, maxNumberOfLines])

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

  const previewScrollStyle = useAnimatedStyle(() => ({
    transform: [{translateY: -scrollY.value}],
  }))

  const isComposing = useRef(false)
  const onKeyPressWeb = useCallback(
    (e: React.KeyboardEvent | any) => {
      /*
       * On mobile web phones, we want to keep the same behavior as the native
       * app. Do not submit the message in these cases.
       */
      if (IS_WEB_TOUCH_DEVICE) return

      // Don't submit the form when the Japanese or any other IME is composing
      if (isComposing.current) return

      /**
       * On Safari, the final keydown event to dismiss the IME - which is the
       * enter key - is also "Enter" below. Obviously, this causes problems
       * because the final dismissal should _not_ submit the text, but should
       * just stop the IME editing. This is the behavior of Chrome and Firefox,
       * but not Safari. Keycode is deprecated, however the alternative seems
       * to only be to compare the timestamp from the onCompositionEnd event to
       * the timestamp of the keydown event, which is not reliable. For
       * example, this hack uses that method:
       * https://github.com/ProseMirror/prosemirror-view/pull/44. However, from
       * my 500ms resulted in far too long of a delay, and a subsequent enter
       * press would often just end up doing nothing. A shorter time frame was
       * also not great, since it was too short to be reliable (i.e. an older
       * system might have a larger time gap between the two events firing.
       *
       * @see https://github.com/bluesky-social/social-app/issues/4178
       * @see https://www.stum.de/2016/06/24/handling-ime-events-in-javascript/
       * @see https://lists.w3.org/Archives/Public/www-dom/2010JulSep/att-0182/keyCode-spec.html
       */
      if (IS_WEB && e.key === 'Enter' && e.keyCode === 229) {
        return
      }

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
      {tapper.state.nodes.map((node, i) => {
        switch (node.type) {
          case 'text': {
            return <Span key={i}>{node.value}</Span>
          }
          case 'trigger':
          case 'facet': {
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
        }
      })}
    </Text>
  )

  return (
    <>
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
          // TODO explain this behavior
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
            setActiveFacet(null)
          }}
          onKeyPress={IS_WEB ? onKeyPressWeb : undefined}
          onScroll={e => {
            if (IS_WEB) {
              scrollY.value = (e.target as any).scrollTop
            } else {
              scrollY.value = e.nativeEvent.contentOffset.y
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

        {children}
      </View>

      {activeFacet && (
        <Portal>
          <Sift
            inverted={!IS_WEB}
            sift={sift}
            data={[
              {
                key: 'alice',
                label: '@alice.test',
                value: '@alice.test',
              },
              {
                key: 'bob',
                label: '@bob.test',
                value: '@bob.test',
              },
              {
                key: 'carol',
                label: '@carol.test',
                value: '@carol.test',
              },
            ]}
            onSelect={item => {
              activeFacet?.replace(item.value)
            }}
            onDismiss={() => setActiveFacet(null)}
            style={[
              a.overflow_hidden,
              a.rounded_md,
              a.border,
              t.atoms.border_contrast_low,
              t.atoms.bg,
              !IS_WEB && a.w_full,
            ]}
            render={({active, props, item}) => (
              <SiftItem
                {...props}
                style={s => [
                  a.px_md,
                  a.py_sm,
                  (active || s.hovered) && t.atoms.bg_contrast_50,
                ]}>
                <Text style={[a.text_md]}>{item.label}</Text>
              </SiftItem>
            )}
          />
        </Portal>
      )}
    </>
  )
}

export function MessageComposer({
  onSendMessage,
  hasEmbed,
  setEmbed,
  children,
}: {
  onSendMessage: (message: string) => void
  hasEmbed: boolean
  setEmbed: (embedUrl: string | undefined) => void
  children?: React.ReactNode
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const playHaptic = useHaptics()
  const {needsEmailVerification} = useEmail()
  const editable = !needsEmailVerification
  const {getDraft, clearDraft} = useMessageDraft()
  const [emojiPickerState, setEmojiPickerState] = useState<EmojiPickerState>({
    isOpen: false,
    pos: {top: 0, left: 0, right: 0, bottom: 0, nextFocusRef: null},
  })
  const composerInternalApiRef = useComposerInternalApiRef()

  const {state: focused, onIn: onFocus, onOut: onBlur} = useInteractionState()
  const {
    state: hovered,
    onIn: onHoverIn,
    onOut: onHoverOut,
  } = useInteractionState()

  const [text, setText] = useState(getDraft)
  useSaveMessageDraft(text)

  const openEmojiPicker = useCallback((pos: any) => {
    setEmojiPickerState({isOpen: true, pos})
  }, [])

  const onSubmit = useCallback(() => {
    if (!editable) return
    if (!hasEmbed && text.trim() === '') return
    if (countGraphemes(text) > MAX_DM_GRAPHEME_LENGTH) {
      Toast.show(l`Message is too long`, {
        type: 'error',
      })
      return
    }

    clearDraft()
    onSendMessage(text)
    playHaptic()
    setEmbed(undefined)
    composerInternalApiRef.current?.clear()

    if (IS_WEB) {
      composerInternalApiRef.current?.input?.focus()
    }
  }, [
    l,
    editable,
    hasEmbed,
    text,
    clearDraft,
    onSendMessage,
    playHaptic,
    setEmbed,
    composerInternalApiRef,
  ])

  useEffect(() => {
    function onEmojiInserted(emoji: Emoji) {
      composerInternalApiRef.current?.insert(emoji.native)
    }
    textInputWebEmitter.addListener('emoji-inserted', onEmojiInserted)
    return () => {
      textInputWebEmitter.removeListener('emoji-inserted', onEmojiInserted)
    }
  }, [])

  return (
    <>
      <View style={[a.px_md, a.pb_sm, a.pt_xs]}>
        {children}
        <View
          // @ts-expect-error web only
          onMouseEnter={onHoverIn}
          onMouseLeave={onHoverOut}>
          <Composer
            internalApiRef={composerInternalApiRef}
            editable={editable}
            autoFocus={IS_WEB}
            label={l`Message input field`}
            placeholder={l`Write a message`}
            defaultValue={text}
            maxNumberOfLines={12}
            style={[
              t.atoms.bg_contrast_25,
              {
                borderWidth: 1,
                borderColor: 'transparent',
                borderRadius: 25,
              },
              editable &&
                hovered && {
                  borderColor: t.atoms.border_contrast_medium.borderColor,
                },
              editable &&
                focused && {
                  borderColor: t.palette.primary_500,
                },
            ]}
            padding={[
              a.p_md,
              {
                paddingRight: 35 + a.p_sm.padding,
              },
              IS_WEB
                ? {
                    paddingLeft: 30 + a.p_sm.padding,
                  }
                : {},
            ]}
            textStyle={[a.text_md, a.leading_snug]}
            onFocus={onFocus}
            onBlur={onBlur}
            onChangeText={setText}
            onFacetCommitted={facet => {
              if (facet.type === 'url' && isBskyPostUrl(facet.value)) {
                setEmbed(facet.value)
              }
            }}
            onRequestSubmit={req => {
              if (req.platform === 'web' && req.shiftKey) return
              req.nativeEvent.preventDefault()
              onSubmit()
            }}>
            {IS_WEB && (
              <Pressable
                onPress={e => {
                  e.currentTarget.measure(
                    (_fx, _fy, _width, _height, px, py) => {
                      openEmojiPicker?.({
                        top: py,
                        left: px,
                        right: px,
                        bottom: py,
                        nextFocusRef: {
                          current:
                            composerInternalApiRef.current?.input?.element,
                        },
                      })
                    },
                  )
                }}
                style={[
                  a.overflow_hidden,
                  a.absolute,
                  a.rounded_full,
                  a.align_center,
                  a.justify_center,
                  a.z_30,
                  {
                    height: 30,
                    width: 30,
                    top: 7,
                    left: 7,
                  },
                ]}
                accessibilityLabel={l`Open emoji picker`}
                accessibilityHint="">
                {state => (
                  <View
                    style={[
                      a.absolute,
                      a.inset_0,
                      a.align_center,
                      a.justify_center,
                      {
                        backgroundColor:
                          state.hovered || state.focused || state.pressed
                            ? t.atoms.bg.backgroundColor
                            : undefined,
                      },
                    ]}>
                    <EmojiSmile size="lg" />
                  </View>
                )}
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={l`Send message`}
              accessibilityHint=""
              hitSlop={HITSLOP_10}
              style={[
                a.absolute,
                a.rounded_full,
                a.align_center,
                a.justify_center,
                a.z_30,
                {
                  height: 35,
                  width: 35,
                  backgroundColor: t.palette.primary_500,
                  top: 4,
                  right: 4,
                },
              ]}
              onPress={onSubmit}
              disabled={!editable}>
              <PaperPlane
                fill={t.palette.white}
                style={[a.relative, {left: 1}]}
              />
            </Pressable>
          </Composer>
        </View>
      </View>

      {IS_WEB && (
        <EmojiPicker
          pinToTop
          state={emojiPickerState}
          close={() => setEmojiPickerState(prev => ({...prev, isOpen: false}))}
        />
      )}
    </>
  )
}
