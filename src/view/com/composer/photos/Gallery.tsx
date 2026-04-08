import {memo, useCallback, useMemo, useRef, useState} from 'react'
import {
  findNodeHandle,
  type ImageStyle,
  Keyboard,
  type LayoutChangeEvent,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native'
import {Image} from 'expo-image'
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {MAX_ALT_TEXT} from '#/lib/constants'
import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {type Dimensions} from '#/lib/media/types'
import {enforceLen} from '#/lib/strings/helpers'
import {colors} from '#/lib/styles'
import {type ComposerImage, cropImage} from '#/state/gallery'
import {atoms as a, tokens, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {MediaInsetBorder} from '#/components/MediaInsetBorder'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {IS_IOS, IS_NATIVE} from '#/env'
import {type PostAction} from '../state/composer'
import {EditImageDialog} from './EditImageDialog'
import {ImageAltTextDialog} from './ImageAltTextDialog'

const IMAGE_GAP = 8

interface GalleryProps {
  images: ComposerImage[]
  dispatch: (action: PostAction) => void
}

export let Gallery = (props: GalleryProps): React.ReactNode => {
  const [containerInfo, setContainerInfo] = useState<Dimensions>()

  const onLayout = (evt: LayoutChangeEvent) => {
    const {width, height} = evt.nativeEvent.layout
    setContainerInfo({
      width,
      height,
    })
  }

  return (
    <View onLayout={onLayout}>
      {containerInfo ? (
        <GalleryInner {...props} containerInfo={containerInfo} />
      ) : undefined}
    </View>
  )
}
Gallery = memo(Gallery)

interface GalleryInnerProps extends GalleryProps {
  containerInfo: Dimensions
}

const GalleryInner = ({images, containerInfo, dispatch}: GalleryInnerProps) => {
  const {isMobile} = useWebMediaQueries()

  const {altTextControlStyle, imageControlsStyle, imageStyle} = useMemo(() => {
    const side =
      images.length === 1
        ? 250
        : (containerInfo.width - IMAGE_GAP * (images.length - 1)) /
          images.length

    const isOverflow = isMobile && images.length > 2

    return {
      altTextControlStyle: isOverflow
        ? {left: 4, bottom: 4}
        : !isMobile && images.length < 3
          ? {left: 8, top: 8}
          : {left: 4, top: 4},
      imageControlsStyle: {
        display: 'flex' as const,
        flexDirection: 'row' as const,
        position: 'absolute' as const,
        ...(isOverflow
          ? {top: 4, right: 4, gap: 4}
          : !isMobile && images.length < 3
            ? {top: 8, right: 8, gap: 8}
            : {top: 4, right: 4, gap: 4}),
        zIndex: 1,
      },
      imageStyle: {
        height: side,
        width: side,
      },
    }
  }, [images.length, containerInfo, isMobile])

  return images.length !== 0 ? (
    <>
      <View testID="selectedPhotosView" style={styles.gallery}>
        {images.map(image => {
          return (
            <GalleryItem
              key={image.source.id}
              image={image}
              altTextControlStyle={altTextControlStyle}
              imageControlsStyle={imageControlsStyle}
              imageStyle={imageStyle}
              onChange={next => {
                dispatch({type: 'embed_update_image', image: next})
              }}
              onRemove={() => {
                dispatch({type: 'embed_remove_image', image})
              }}
            />
          )
        })}
      </View>
      {(() => {
        const firstMissing = images.find(image => !image.alt)
        if (!firstMissing) return null
        return (
          <InlineAltTextInput
            key={firstMissing.source.id}
            image={firstMissing}
            imageCount={images.length}
            imageIndex={images.indexOf(firstMissing)}
            onChange={next => {
              dispatch({type: 'embed_update_image', image: next})
            }}
          />
        )
      })()}
    </>
  ) : null
}

const InlineAltTextInput = ({
  image,
  imageCount,
  imageIndex,
  onChange,
}: {
  image: ComposerImage
  imageCount: number
  imageIndex: number
  onChange: (next: ComposerImage) => void
}) => {
  const {_} = useLingui()
  const t = useTheme()
  const textRef = useRef(image.alt)

  const handleChangeText = useCallback((text: string) => {
    textRef.current = text
  }, [])

  const handleBlur = useCallback(() => {
    const trimmed = textRef.current.trim()
    if (trimmed !== image.alt) {
      onChange({...image, alt: enforceLen(trimmed, MAX_ALT_TEXT, true)})
    }
  }, [image, onChange])

  return (
    <View style={[a.mt_sm, a.flex_row, a.gap_sm, a.align_start]}>
      <Image
        source={{uri: (image.transformed ?? image.source).path}}
        style={{width: 40, height: 40, borderRadius: 6}}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
      <View style={[a.flex_1]}>
        {imageCount > 1 && (
          <Text style={[a.text_xs, a.mb_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              Image {imageIndex + 1} of {imageCount}
            </Trans>
          </Text>
        )}
        <TextField.Root>
          <TextField.Input
            label={_(msg`Alt text`)}
            defaultValue={image.alt}
            onChangeText={handleChangeText}
            onBlur={handleBlur}
            placeholder={_(
              msg`Describe this image for blind and low-vision users...`,
            )}
            multiline
            numberOfLines={2}
          />
        </TextField.Root>
      </View>
    </View>
  )
}

type GalleryItemProps = {
  image: ComposerImage
  altTextControlStyle?: ViewStyle
  imageControlsStyle?: ViewStyle
  imageStyle?: ImageStyle
  onChange: (next: ComposerImage) => void
  onRemove: () => void
}

const GalleryItem = ({
  image,
  altTextControlStyle,
  imageControlsStyle,
  imageStyle,
  onChange,
  onRemove,
}: GalleryItemProps): React.ReactNode => {
  const {_} = useLingui()
  const t = useTheme()
  const ax = useAnalytics()

  const altTextControl = Dialog.useDialogControl()
  const editControl = Dialog.useDialogControl()
  const [altBtnViewTag, setAltBtnViewTag] = useState<number>()

  const altBtnRef = (node: View | null) => {
    // for iOS 26 fluid transition
    if (IS_IOS && node) {
      const tag = findNodeHandle(node)
      if (tag != null) setAltBtnViewTag(tag)
    }
  }

  const onImageEdit = () => {
    ax.metric('composer:image:edit', {
      platform: Platform.OS,
    })

    if (IS_NATIVE) {
      cropImage(image).then(next => {
        onChange(next)
      })
    } else {
      editControl.open()
    }
  }

  const onAltTextEdit = () => {
    Keyboard.dismiss()
    altTextControl.open()
  }

  return (
    <View
      ref={altBtnRef}
      style={imageStyle as ViewStyle}
      // Fixes ALT and icons appearing with half opacity when the post is inactive
      renderToHardwareTextureAndroid>
      <TouchableOpacity
        testID="altTextButton"
        accessibilityRole="button"
        accessibilityLabel={_(msg`Add alt text`)}
        accessibilityHint=""
        onPress={onAltTextEdit}
        style={[styles.altTextControl, altTextControlStyle]}>
        {image.alt.length !== 0 ? (
          <FontAwesomeIcon
            icon="check"
            size={10}
            style={{color: t.palette.white}}
          />
        ) : (
          <FontAwesomeIcon
            icon="plus"
            size={10}
            style={{color: t.palette.white}}
          />
        )}
        <Text style={styles.altTextControlLabel} accessible={false}>
          <Trans>ALT</Trans>
        </Text>
      </TouchableOpacity>
      <View style={imageControlsStyle}>
        <TouchableOpacity
          testID="editPhotoButton"
          accessibilityRole="button"
          accessibilityLabel={_(msg`Edit image`)}
          accessibilityHint=""
          onPress={onImageEdit}
          style={styles.imageControl}>
          <FontAwesomeIcon icon="pen" size={12} style={{color: colors.white}} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="removePhotoButton"
          accessibilityRole="button"
          accessibilityLabel={_(msg`Remove image`)}
          accessibilityHint=""
          onPress={onRemove}
          style={styles.imageControl}>
          <FontAwesomeIcon
            icon="xmark"
            size={16}
            style={{color: colors.white}}
          />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={_(msg`Add alt text`)}
        accessibilityHint=""
        onPress={onAltTextEdit}
        style={styles.altTextHiddenRegion}
      />

      <Image
        testID="selectedPhotoImage"
        style={[styles.image, imageStyle]}
        source={{
          uri: (image.transformed ?? image.source).path,
        }}
        accessible={true}
        accessibilityIgnoresInvertColors
        cachePolicy="none"
        autoplay={false}
        contentFit="cover"
      />

      <MediaInsetBorder />

      <ImageAltTextDialog
        control={altTextControl}
        image={image}
        onChange={onChange}
        sourceViewTag={altBtnViewTag}
      />

      <EditImageDialog
        control={editControl}
        image={image}
        onChange={onChange}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  gallery: {
    flex: 1,
    flexDirection: 'row',
    gap: IMAGE_GAP,
    marginTop: 16,
  },
  image: {
    borderRadius: tokens.borderRadius.md,
  },
  imageControl: {
    width: 24,
    height: 24,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  altTextControl: {
    position: 'absolute',
    zIndex: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  altTextControlLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  altTextHiddenRegion: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    top: 30,
    zIndex: 1,
  },
})
