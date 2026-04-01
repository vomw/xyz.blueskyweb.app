import {useContext, useMemo, useRef, useState} from 'react'
import {FlatList, Pressable, useWindowDimensions, View} from 'react-native'
import {DrawerGestureContext} from 'react-native-drawer-layout'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import {type AnimatedRef, useAnimatedRef} from 'react-native-reanimated'
import {Image} from 'expo-image'
import {type AppBskyEmbedImages} from '@atproto/api'
import {utils} from '@bsky.app/alf'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {type Dimensions} from '#/lib/media/types'
import {useA11y} from '#/state/a11y'
import {useLargeAltBadgeEnabled} from '#/state/preferences/large-alt-badge'
import {atoms as a, useTheme} from '#/alf'
import {MediaInsetBorder} from '#/components/MediaInsetBorder'
import {PostEmbedViewContext} from '#/components/Post/Embed/types'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'

const CONTAINER_ASPECT_RATIO = 4 / 3
const ITEM_GAP = 8 // tokens.space.sm

interface GalleryProps {
  images: AppBskyEmbedImages.ViewImage[]
  onPress?: (
    index: number,
    containerRefs: AnimatedRef<any>[],
    fetchedDims: (Dimensions | null)[],
  ) => void
  onPressIn?: (index: number) => void
  viewContext?: PostEmbedViewContext
}

export function Gallery({
  images,
  onPress,
  onPressIn,
  viewContext,
}: GalleryProps) {
  const t = useTheme()
  const {_} = useLingui()
  const ax = useAnalytics()
  const {screenReaderEnabled} = useA11y()
  const largeAltBadge = useLargeAltBadgeEnabled()
  const currentPageRef = useRef(0)
  const {width: windowWidth} = useWindowDimensions()
  const [leftOffset, setLeftOffset] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)

  const containerRefs = useRef<AnimatedRef<any>[]>([]).current
  const thumbDimsRef = useRef<(Dimensions | null)[]>([])

  const ref0 = useAnimatedRef()
  const ref1 = useAnimatedRef()
  const ref2 = useAnimatedRef()
  const ref3 = useAnimatedRef()
  const refs = [ref0, ref1, ref2, ref3]
  for (let i = 0; i < images.length; i++) {
    containerRefs[i] = refs[i]
  }

  const isWithinQuote =
    viewContext === PostEmbedViewContext.FeedEmbedRecordWithMedia
  const hideBadges = isWithinQuote

  const containerHeight =
    containerWidth > 0 ? containerWidth / CONTAINER_ASPECT_RATIO : 0
  // Bleed: full-width carousel that extends to screen edges
  // In quotes: small bleed to the quote card border (p_md = 12px)
  const QUOTE_PADDING = 12
  const bleed = !isWithinQuote
  const insetLeft = bleed
    ? leftOffset || windowWidth - containerWidth
    : QUOTE_PADDING
  const insetRight = bleed
    ? windowWidth - insetLeft - containerWidth
    : QUOTE_PADDING

  const getItemWidth = (image: AppBskyEmbedImages.ViewImage) => {
    const ar = image.aspectRatio
    if (ar && ar.width > 0 && ar.height > 0) {
      const ratio = ar.width / ar.height
      // Width derived from image's own aspect ratio at the fixed container height
      const w = containerHeight * ratio
      // Clamp: at least 40% of content width, at most the full content width
      return Math.max(containerWidth * 0.4, Math.min(w, containerWidth))
    }
    return containerWidth
  }

  if (screenReaderEnabled) {
    return (
      <View
        style={[a.rounded_md, a.overflow_hidden]}
        accessibilityRole="adjustable">
        {images.map((image, index) => (
          <View
            key={index}
            ref={containerRefs[index]}
            collapsable={false}
            style={[
              {aspectRatio: CONTAINER_ASPECT_RATIO},
              t.atoms.bg_contrast_25,
            ]}>
            <Pressable
              onPress={
                onPress
                  ? () =>
                      onPress(
                        index,
                        containerRefs.slice(0, images.length),
                        thumbDimsRef.current.slice(),
                      )
                  : undefined
              }
              onPressIn={onPressIn ? () => onPressIn(index) : undefined}
              accessibilityRole="button"
              accessibilityLabel={
                image.alt || _(msg`Image ${index + 1} of ${images.length}`)
              }
              accessibilityHint={_(msg`Opens full image`)}
              style={[a.flex_1]}>
              <Image
                source={{uri: image.thumb}}
                style={[a.flex_1]}
                contentFit="cover"
                accessible={true}
                accessibilityLabel={image.alt}
                accessibilityHint=""
                accessibilityIgnoresInvertColors
                onLoad={e => {
                  thumbDimsRef.current[index] = {
                    width: e.source.width,
                    height: e.source.height,
                  }
                }}
                loading={index === 0 ? 'eager' : 'lazy'}
              />
              <MediaInsetBorder />
            </Pressable>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View
      style={
        containerWidth > 0
          ? {height: containerHeight, overflow: 'visible'}
          : {aspectRatio: CONTAINER_ASPECT_RATIO}
      }
      onLayout={e => {
        const w = e.nativeEvent.layout.width
        if (w > 0) {
          setContainerWidth(w)
        }
        e.target.measureInWindow((x: number) => {
          if (x > 0) {
            setLeftOffset(x)
          }
        })
      }}>
      {containerWidth > 0 && (
        <DrawerGestureBlocker>
          <FlatList
            data={images}
            horizontal
            pagingEnabled={false}
            showsHorizontalScrollIndicator={false}
            snapToOffsets={images.reduce<number[]>((offsets, image, i) => {
              const prev =
                i === 0
                  ? 0
                  : offsets[i - 1] + getItemWidth(images[i - 1]) + ITEM_GAP
              offsets.push(prev)
              return offsets
            }, [])}
            snapToAlignment="start"
            decelerationRate={0.99}
            style={{
              width: bleed ? windowWidth : containerWidth + QUOTE_PADDING * 2,
              height: containerHeight,
              marginLeft: -insetLeft,
            }}
            contentContainerStyle={{
              gap: ITEM_GAP,
              paddingLeft: insetLeft,
              paddingRight: insetRight,
            }}
            onScroll={e => {
              const offsetX = e.nativeEvent.contentOffset.x
              // Determine which item is most visible based on scroll position
              let accumulated = insetLeft // account for left content padding
              let page = 0
              for (let i = 0; i < images.length; i++) {
                const w = getItemWidth(images[i]) + ITEM_GAP
                if (offsetX < accumulated + w / 2) {
                  page = i
                  break
                }
                accumulated += w
                page = i
              }
              if (page !== currentPageRef.current) {
                ax.metric('post:gallery:swipe', {
                  fromIndex: currentPageRef.current,
                  toIndex: page,
                  totalImages: images.length,
                })
                currentPageRef.current = page
              }
            }}
            scrollEventThrottle={16}
            keyExtractor={(_, index) => String(index)}
            renderItem={({item: image, index}) => (
              <View
                ref={containerRefs[index]}
                collapsable={false}
                style={[
                  {
                    width: getItemWidth(image),
                    height: containerHeight,
                  },
                ]}>
                <Pressable
                  onPress={
                    onPress
                      ? () => {
                          ax.metric('post:gallery:openLightbox', {
                            imageIndex: index,
                            totalImages: images.length,
                          })
                          onPress(
                            index,
                            containerRefs.slice(0, images.length),
                            thumbDimsRef.current.slice(),
                          )
                        }
                      : undefined
                  }
                  onPressIn={onPressIn ? () => onPressIn(index) : undefined}
                  android_ripple={{
                    color: utils.alpha(t.atoms.bg.backgroundColor, 0.2),
                    foreground: true,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    image.alt || _(msg`Image ${index + 1} of ${images.length}`)
                  }
                  accessibilityHint={_(msg`Opens full image`)}
                  style={[
                    a.flex_1,
                    a.rounded_md,
                    a.overflow_hidden,
                    t.atoms.bg_contrast_25,
                  ]}>
                  <Image
                    source={{uri: image.thumb}}
                    style={[a.flex_1]}
                    contentFit="cover"
                    accessible={true}
                    accessibilityLabel={image.alt}
                    accessibilityHint=""
                    accessibilityIgnoresInvertColors
                    onLoad={e => {
                      thumbDimsRef.current[index] = {
                        width: e.source.width,
                        height: e.source.height,
                      }
                    }}
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                  <MediaInsetBorder />
                </Pressable>
                {image.alt && !hideBadges ? (
                  <View
                    accessible={false}
                    style={[
                      a.absolute,
                      a.flex_row,
                      a.align_center,
                      a.rounded_xs,
                      t.atoms.bg_contrast_25,
                      {
                        gap: 3,
                        padding: 3,
                        bottom: a.p_xs.padding,
                        right: a.p_xs.padding,
                        opacity: 0.8,
                      },
                      largeAltBadge && {
                        gap: 4,
                        padding: 5,
                      },
                    ]}>
                    <Text
                      style={[
                        a.font_bold,
                        largeAltBadge ? a.text_xs : {fontSize: 8},
                      ]}>
                      <Trans>ALT</Trans>
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          />
        </DrawerGestureBlocker>
      )}
    </View>
  )
}

function DrawerGestureBlocker({children}: {children: React.ReactNode}) {
  const drawerGesture = useContext(DrawerGestureContext)

  const nativeGesture = useMemo(() => {
    const gesture = Gesture.Native()
    if (drawerGesture) {
      gesture.blocksExternalGesture(drawerGesture)
    }
    return gesture
  }, [drawerGesture])

  return <GestureDetector gesture={nativeGesture}>{children}</GestureDetector>
}
