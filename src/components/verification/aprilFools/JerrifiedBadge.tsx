import {UnverifiedX} from '#/components/icons/UnverifiedX'
import type * as bsky from '#/types/bsky'

const JERRY = 'did:plc:vc7f4oafdgxsihk4cry2xpze'

export function isJerrifiedAccount(profile: bsky.profile.AnyProfileView) {
  return profile.did === JERRY
}

export function JerrifiedBadge({width}: {width: number}) {
  return <UnverifiedX width={width} />
}
