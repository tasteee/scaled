import * as childProcess from 'node:child_process'
import * as url from 'node:url'

const checkScripts = [
  'checkCore.mjs',
  'checkMidi.mjs',
  'checkTiming.mjs',
  'checkRhythmAdaptation.mjs',
  'checkFactoryPerformances.mjs',
  'checkChordFollowing.mjs',
  'checkPerformanceSpeed.mjs',
  'checkPassageAdaptation.mjs',
  'checkPlayback.mjs',
  'checkDemoPerformances.mjs',
  'checkScaleChordParity.mjs',
  'checkSuggestions.mjs'
]

for (const checkScript of checkScripts) {
  console.log(`Checking ${checkScript}`)
  const checkUrl = new URL(checkScript, import.meta.url)
  const checkPath = url.fileURLToPath(checkUrl)
  childProcess.execFileSync(process.execPath, [checkPath], { stdio: 'inherit' })
}

console.log('All library and demo regression checks passed.')
