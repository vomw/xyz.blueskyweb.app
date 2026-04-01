import {useRef, useState} from 'react'
import {Pressable, ScrollView, useWindowDimensions, View} from 'react-native'
import {type AnimatedRef, useAnimatedRef} from 'react-native-reanimated'
import {Image} from 'expo-image'
import {type AppBskyEmbedImages} from '@atproto/api'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {type Dimensions} from '#/lib/media/types'
import {useLargeAltBadgeEnabled} from '#/state/preferences/large-alt-badge'
import {atoms as a, useTheme, web} from '#/alf'
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
  const largeAltBadge = useLargeAltBadgeEnabled()
  const currentPageRef = useRef(0)
  const scrollRef = useRef<ScrollView>(null)
  const {width: windowWidth} = useWindowDimensions()
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
  const QUOTE_PADDING = 12
  const bleed = !isWithinQuote
  const insetLeft = bleed
    ? Math.max(windowWidth - containerWidth, 0)
    : QUOTE_PADDING
  const insetRight = bleed
    ? Math.max(windowWidth - insetLeft - containerWidth, 0)
    : QUOTE_PADDING

  const getItemWidth = (image: AppBskyEmbedImages.ViewImage) => {
    const ar = image.aspectRatio
    if (ar && ar.width > 0 && ar.height > 0) {
      const ratio = ar.width / ar.height
      const w = containerHeight * ratio
      return Math.max(containerWidth * 0.4, Math.min(w, containerWidth))
    }
    return containerWidth
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const scrollEl = scrollRef.current as unknown as {
      scrollTo: (opts: {x: number; animated: boolean}) => void
    }
    if (!scrollEl) return

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      scrollEl.scrollTo({
        x: Math.max(0, currentScrollX.current - 200),
        animated: true,
      })
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      scrollEl.scrollTo({x: currentScrollX.current + 200, animated: true})
    }
  }
  const currentScrollX = useRef(0)

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
      }}
      // @ts-expect-error web-only prop
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      aria-label={_(msg`Image gallery, ${images.length} images`)}>
      {containerWidth > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={[
            {
              width: bleed ? windowWidth : containerWidth + QUOTE_PADDING * 2,
              height: containerHeight,
              marginLeft: -insetLeft,
            },
            web({
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch',
            }),
          ]}
          contentContainerStyle={{
            gap: ITEM_GAP,
            paddingLeft: insetLeft,
            paddingRight: insetRight,
          }}
          onScroll={e => {
            const offsetX = e.nativeEvent.contentOffset.x
            currentScrollX.current = offsetX
            let accumulated = insetLeft
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
          }}>
          {images.map((image, index) => (
            <View
              key={index}
              ref={containerRefs[index]}
              collapsable={false}
              style={[
                {
                  width: getItemWidth(image),
                  height: containerHeight,
                },
              ]}
              aria-roledescription="slide"
              aria-label={
                image.alt || _(msg`Image ${index + 1} of ${images.length}`)
              }>
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
                  web({cursor: 'pointer'}),
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
          ))}
        </ScrollView>
      )}
    </View>
  )
}
