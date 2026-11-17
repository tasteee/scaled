import * as assert from 'node:assert/strict'
import * as childProcess from 'node:child_process'
import * as filesystem from 'node:fs'
import * as operatingSystem from 'node:os'
import * as path from 'node:path'
import * as url from 'node:url'

const repositoryDirectory = url.fileURLToPath(new URL('../', import.meta.url))
const npmPath = process.env.npm_execpath
assert.ok(npmPath, 'Run this check with npm run check:package.')

const runNpm = (argumentsList, directory) => {
	const commandArguments = [npmPath, ...argumentsList]
	const output = childProcess.execFileSync(process.execPath, commandArguments, { cwd: directory, encoding: 'utf8' })
	return output
}

const checkPackageFiles = (packedPackage) => {
	const filePaths = packedPackage.files.map((file) => {
		return file.path
	})

	const requiredFiles = [
		'package.json',
		'README.md',
		'LICENSE',
		'dist/index.mjs',
		'dist/index.d.mts',
		'dist/types.mjs',
		'dist/types.d.mts'
	]

	for (const requiredFile of requiredFiles) {
		const hasRequiredFile = filePaths.includes(requiredFile)
		assert.ok(hasRequiredFile, `Package is missing ${requiredFile}`)
	}
	for (const filePath of filePaths) {
		const isDistributionFile = filePath.startsWith('dist/')
		const isRequiredFile = requiredFiles.includes(filePath)
		const isAllowedFile = isDistributionFile || isRequiredFile
		assert.ok(isAllowedFile, `Unexpected packaged file: ${filePath}`)
	}
	return undefined
}

const consumerSource = `
import * as assert from 'node:assert/strict'
import * as library from '@tasteee/scaled'
import * as constants from '@tasteee/scaled/types'
import type * as publicTypes from '@tasteee/scaled/types'

const engine: publicTypes.ScaledT = library.scaled.createEngine()
const chord: publicTypes.ScaledT.ChordT = engine.getChord({ chord: 'Cmaj7' })
assert.deepEqual(chord.midiNotes, [60, 64, 67, 71])
assert.equal(constants.ChordFamily.triad, 'triad')
const hasFactoryTemplates = engine.performanceTemplates.length > 0
assert.ok(hasFactoryTemplates)
const pattern: publicTypes.ScaledT.PerformancePatternT = {
  id: 'consumer', name: 'Consumer', durationBeats: 1,
  events: [{ startBeat: 0, durationBeats: 0.5, pitch: { type: 'chordTone', index: 0 } }]
}
const clip = engine.applyPerformance({ progression: [{ chord, durationBeats: 2 }], performance: pattern })
assert.equal(clip.notes.length, 2)
const midi = engine.exportMidi({ clip })
const signatureBytes = midi.subarray(0, 4)
const signature = Array.from(signatureBytes)
assert.deepEqual(signature, [77, 84, 104, 100])
// @ts-expect-error Unknown voicing names must be rejected.
const invalidVoicing: publicTypes.ScaledT.VoicingNameT = 'not-a-voicing'
console.log('Packed consumer runtime and types passed.')
`

const compileConsumer = (directory, consumerPath) => {
	const compilerPath = path.join(repositoryDirectory, 'node_modules/typescript/bin/tsc')
	const nodeTypeDirectory = path.join(repositoryDirectory, 'node_modules/@types')
	const compilerArguments = [
		compilerPath,
		'--ignoreConfig',
		'--strict',
		'--module', 'NodeNext',
		'--moduleResolution', 'NodeNext',
		'--target', 'ES2022',
		'--types', 'node',
		'--typeRoots', nodeTypeDirectory,
		consumerPath
	]
	childProcess.execFileSync(process.execPath, compilerArguments, { cwd: directory, stdio: 'inherit' })
	return undefined
}

const checkConsumer = (directory, archivePath) => {
	const manifestPath = path.join(directory, 'package.json')
	filesystem.writeFileSync(manifestPath, '{"private":true,"type":"module"}\n')
	const installArguments = ['install', archivePath, '--ignore-scripts', '--no-audit', '--no-fund', '--offline']
	runNpm(installArguments, directory)
	const consumerPath = path.join(directory, 'consumer.mts')
	filesystem.writeFileSync(consumerPath, consumerSource)
	compileConsumer(directory, consumerPath)
	const compiledConsumerPath = path.join(directory, 'consumer.mjs')
	childProcess.execFileSync(process.execPath, [compiledConsumerPath], { cwd: directory, stdio: 'inherit' })
	return undefined
}

const temporaryRoot = path.resolve(operatingSystem.tmpdir())
const temporaryPrefix = path.join(temporaryRoot, 'scaled-release-')
const consumerDirectory = filesystem.mkdtempSync(temporaryPrefix)

try {
	const packArguments = ['pack', '--ignore-scripts', '--json', '--pack-destination', consumerDirectory]
	const packOutput = runNpm(packArguments, repositoryDirectory)
	const packedPackages = JSON.parse(packOutput)
	assert.equal(packedPackages.length, 1)
	const packedPackage = packedPackages[0]
	checkPackageFiles(packedPackage)
	const archivePath = path.join(consumerDirectory, packedPackage.filename)
	checkConsumer(consumerDirectory, archivePath)
} finally {
	const resolvedDirectory = path.resolve(consumerDirectory)
	const isInsideTemporaryRoot = path.dirname(resolvedDirectory) === temporaryRoot
	const hasExpectedPrefix = path.basename(resolvedDirectory).startsWith('scaled-release-')
	const canRemoveDirectory = isInsideTemporaryRoot && hasExpectedPrefix
	assert.ok(canRemoveDirectory, 'Refusing to remove a directory outside the temporary consumer workspace.')
	filesystem.rmSync(resolvedDirectory, { recursive: true, force: true })
}

console.log('Packed files, isolated installation, public exports and consumer types passed.')
