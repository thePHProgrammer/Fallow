import type { BirdSceneHandle } from './birdScene'

/** The one live background scene, shared between the backdrop (which owns
 *  it) and the feeder button on the Focus tab. */
let current: BirdSceneHandle | null = null

export function setScene(scene: BirdSceneHandle | null): void {
  current = scene
}

export function getScene(): BirdSceneHandle | null {
  return current
}
