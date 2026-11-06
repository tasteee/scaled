const byteLabels = Array.from({ length: 255 }, (_, byteNumber) => {
  return byteNumber + 1
})

export const decodeSuggestionTrie = (units) => {
  const entries = []

  const visitNode = (nodeAddress, prefixBytes) => {
    const isTooDeep = prefixBytes.length > 512
    if (isTooDeep) throw new Error('Unexpected suggestion trie depth')

    const unit = units[nodeAddress]
    const offsetShift = (unit >>> 6) & 8
    const offset = (unit >>> 10) << offsetShift
    const childBase = (nodeAddress ^ offset) >>> 0
    const hasTerminal = (unit & 256) !== 0

    if (hasTerminal) {
      const token = Buffer.from(prefixBytes).toString('utf8')
      const weight = units[childBase] & 0x7fffffff
      entries.push({ token, weight })
    }

    for (const byteLabel of byteLabels) {
      const childAddress = (childBase ^ byteLabel) >>> 0
      const isOutsideTrie = childAddress >= units.length
      if (isOutsideTrie) continue

      const storedLabel = units[childAddress] & 0x800000ff
      const isMatchingChild = storedLabel === byteLabel
      if (!isMatchingChild) continue

      const childPrefix = prefixBytes.concat(byteLabel)
      visitNode(childAddress, childPrefix)
    }
    return undefined
  }

  visitNode(0, [])
  return entries
}
