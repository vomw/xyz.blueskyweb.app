import {forwardRef} from 'react'
import Svg, {Circle, Path} from 'react-native-svg'

import {type Props, useCommonSVGProps} from '#/components/icons/common'

export const UnverifiedX = forwardRef<Svg, Props>(
  function LogoImpl(props, ref) {
    const {fill, size, style, ...rest} = useCommonSVGProps(props)

    return (
      <Svg
        fill="none"
        {...rest}
        ref={ref}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={[style]}>
        <Circle cx="12" cy="12" r="11.5" fill={fill} />
        <Path
          fill="#fff"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M15.117 7.116a1.25 1.25 0 0 1 1.767 1.768L13.767 12l3.2 3.2a1.25 1.25 0 0 1-1.767 1.768l-3.2-3.2-3.116 3.116a1.25 1.25 0 1 1-1.767-1.768L10.232 12 7.2 8.967A1.25 1.25 0 1 1 8.967 7.2L12 10.232l3.118-3.116Z"
        />
      </Svg>
    )
  },
)
