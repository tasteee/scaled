export const setNativeChordName = (host, playable, chordName) => {
  const createStringType = host.koffi.proto('void *CreateMetadataString(void *output, str text)')
  const setMetadataType = host.koffi.proto('void SetMetadataPair(void *playable, void *pair)')
  const releasePairType = host.koffi.proto('void ReleaseMetadataPair(void *pair)')
  const pair = Buffer.alloc(16)
  host.koffi.call(host.pluginBase + 0x52780n, createStringType, pair, 'chordName')
  const valueSlot = pair.subarray(8)
  host.koffi.call(host.pluginBase + 0x52780n, createStringType, valueSlot, chordName)
  host.koffi.call(host.pluginBase + 0x7987d0n, setMetadataType, playable, pair)
  host.koffi.call(host.pluginBase + 0x4ba30n, releasePairType, pair)
  return undefined
}
