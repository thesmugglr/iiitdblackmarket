export const BUILD_MARKER = 'iiitdblackmarket-static-output'

/** Never replace an arbitrary/source repository with generated files. */
export function validatePagesTarget(metadata, marker) {
  if (metadata.private !== false || metadata.visibility !== 'public') throw new Error('Pages target must already be a public build-only repository.')
  if (metadata.archived || metadata.default_branch !== 'main') throw new Error('Pages target must be active with main as its default branch.')
  if (marker.trim() !== BUILD_MARKER) throw new Error('Pages target must contain .iiitd-market-build-only on main; see docs/launch.md.')
}
