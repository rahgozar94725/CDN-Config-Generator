// TEMPORARY — proves the CI check fails a pull request when the suite is red.
// Reverted immediately after the failed run is observed. See
// .evidence/work/U1.md.
import { describe, it, expect } from 'vitest'

describe('CI red probe', () => {
  it('fails on purpose so the pull-request check can be watched going red', () => {
    expect(1).toBe(2)
  })
})
