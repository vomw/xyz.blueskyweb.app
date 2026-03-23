import {useMemo} from 'react'

import {useNux, useSaveNux} from '#/state/queries/nuxs'
import {ACTIVE_UPDATE_ID} from '#/components/PolicyUpdateOverlay/config'
import {logger} from '#/components/PolicyUpdateOverlay/logger'
import {IS_DEV} from '#/env'
import {device, useStorage} from '#/storage'

export type PolicyUpdateState = {
  completed: boolean
  complete: () => void
}

export function usePolicyUpdateState({
  enabled,
}: {
  /**
   * Used to skip the policy update overlay until we're actually ready to
   * show it.
   */
  enabled: boolean
}) {
  const nux = useNux(ACTIVE_UPDATE_ID)
  const {mutate: save, variables} = useSaveNux()
  const deviceStorage = useStorage(device, [ACTIVE_UPDATE_ID])
  const debugOverride =
    !!useStorage(device, ['policyUpdateDebugOverride'])[0] && IS_DEV

  return useMemo(() => {
    /**
     * If not enabled, then just return a completed state so the app functions
     * as normal.
     */
    if (!enabled) {
      return {
        completed: true,
        complete() {},
      }
    }

    const nuxIsCompleted = nux.nux?.completed === true
    const nuxIsOptimisticallyCompleted = !!variables?.completed
    const [completedForDevice, setCompletedForDevice] = deviceStorage

    const completed = computeCompletedState({
      nuxIsCompleted,
      nuxIsOptimisticallyCompleted,
      completedForDevice,
    })

    logger.debug(`state`, {
      completed,
      nux,
      completedForDevice,
    })

    if (!debugOverride) {
      syncCompletedState({
        nuxIsCompleted,
        nuxIsOptimisticallyCompleted,
        completedForDevice,
        save,
        setCompletedForDevice,
      })
    }

    return {
      completed,
      complete() {
        logger.debug(`user completed`)
        save({
          id: ACTIVE_UPDATE_ID,
          completed: true,
          data: undefined,
        })
        setCompletedForDevice(true)
      },
    }
  }, [enabled, nux, save, variables, deviceStorage, debugOverride])
}

export function computeCompletedState({
  nuxIsCompleted,
  nuxIsOptimisticallyCompleted,
  completedForDevice,
}: {
  nuxIsCompleted: boolean
  nuxIsOptimisticallyCompleted: boolean
  completedForDevice: boolean | undefined
}): boolean {
  /**
   * Prefer server state, if available
   */
  let completed = nuxIsCompleted

  /**
   * Override with optimistic state or device state
   */
  if (nuxIsOptimisticallyCompleted || !!completedForDevice) {
    completed = true
  }

  return completed
}

export function syncCompletedState({
  nuxIsCompleted,
  nuxIsOptimisticallyCompleted,
  completedForDevice,
  save,
  setCompletedForDevice,
}: {
  nuxIsCompleted: boolean
  nuxIsOptimisticallyCompleted: boolean
  completedForDevice: boolean | undefined
  save: ReturnType<typeof useSaveNux>['mutate']
  setCompletedForDevice: (value: boolean) => void
}) {
  /*
   * Sync device state to server state for this account
   */
  if (
    !nuxIsCompleted &&
    !nuxIsOptimisticallyCompleted &&
    !!completedForDevice
  ) {
    logger.debug(`syncing device state to server state`)
    save({
      id: ACTIVE_UPDATE_ID,
      completed: true,
      data: undefined,
    })
  } else if (nuxIsCompleted && !completedForDevice) {
    logger.debug(`syncing server state to device state`)
    /*
     * Sync server state to device state
     */
    setCompletedForDevice(true)
  }
}
