#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const policyPath = path.join(repoRoot, 'docs/legal/license-policy.json')
const generatedDir = path.join(repoRoot, 'docs/legal/generated')

const args = new Set(process.argv.slice(2))
const shouldGenerate = args.has('--generate')
const shouldCheck = args.has('--check') || !shouldGenerate

const policy = JSON.parse(readFileSync(policyPath, 'utf8'))
const allowedLicenses = new Set(policy.allowedLicenses)
const reviewLicenses = new Set(policy.reviewLicenses)

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function runCargoMetadata() {
  const output = execFileSync('cargo', [
    'metadata',
    '--manifest-path',
    'src-tauri/Cargo.toml',
    '--locked',
    '--format-version',
    '1',
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(output)
}

function normalizeLicenseExpression(expression) {
  if (!expression) {
    return []
  }

  return String(expression)
    .replaceAll('(', ' ')
    .replaceAll(')', ' ')
    .replaceAll('/', ' OR ')
    .replace(/\bWITH\b/g, ' AND ')
    .split(/\bAND\b|\bOR\b|,/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function licenseOptions(expression) {
  if (!expression) {
    return []
  }

  return String(expression)
    .replaceAll('(', ' ')
    .replaceAll(')', ' ')
    .replaceAll('/', ' OR ')
    .split(/\bOR\b/)
    .map((option) => option
      .replace(/\bWITH\b/g, ' AND ')
      .split(/\bAND\b|,/)
      .map((part) => part.trim())
      .filter(Boolean))
    .filter((option) => option.length > 0)
}

function classifyLicense(ecosystem, name, licenseExpression) {
  const reviewReason = policy.reviewPackages?.[ecosystem]?.[name]
  if (reviewReason) {
    return {
      status: 'review',
      reason: reviewReason,
    }
  }

  const licenses = normalizeLicenseExpression(licenseExpression)
  if (licenses.length === 0) {
    return {
      status: 'fail',
      reason: 'missing license metadata',
    }
  }

  const options = licenseOptions(licenseExpression)
  if (options.some((option) => option.every((license) => allowedLicenses.has(license)))) {
    return {
      status: 'allow',
      reason: 'allowed license',
    }
  }

  const unrecognized = licenses.filter((license) => (
    !allowedLicenses.has(license) && !reviewLicenses.has(license)
  ))
  if (unrecognized.length > 0) {
    return {
      status: 'fail',
      reason: `unreviewed license: ${unrecognized.join(', ')}`,
    }
  }

  const reviewMatches = licenses.filter((license) => reviewLicenses.has(license))
  if (reviewMatches.length > 0) {
    return {
      status: 'review',
      reason: `review-sensitive license: ${reviewMatches.join(', ')}`,
    }
  }

  return {
    status: 'allow',
    reason: 'allowed license',
  }
}

function cargoInventory() {
  const metadata = runCargoMetadata()
  const root = metadata.packages.find((item) => item.id === metadata.resolve.root)
  const directCargoDeps = new Set((root?.dependencies ?? [])
    .filter((dependency) => dependency.kind !== 'dev')
    .map((dependency) => dependency.name))

  return metadata.packages
    .filter((pkg) => pkg.source !== null)
    .map((pkg) => {
      const classification = classifyLicense('cargo', pkg.name, pkg.license)
      return {
        ecosystem: 'cargo',
        name: pkg.name,
        version: pkg.version,
        license: pkg.license ?? null,
        licenseFile: pkg.license_file ?? null,
        status: classification.status,
        reason: classification.reason,
        direct: directCargoDeps.has(pkg.name),
        source: pkg.source,
        repository: pkg.repository ?? null,
        links: pkg.links ?? null,
      }
    })
    .sort(compareInventoryItems)
}

function npmInventory() {
  const lockfile = readJson(path.join(repoRoot, 'package-lock.json'))
  const rootDeps = new Set([
    ...Object.keys(lockfile.packages?.['']?.dependencies ?? {}),
    ...Object.keys(lockfile.packages?.['']?.devDependencies ?? {}),
  ])

  return Object.entries(lockfile.packages ?? {})
    .filter(([packagePath]) => packagePath.startsWith('node_modules/'))
    .map(([packagePath, pkg]) => {
      const name = packagePath.replace(/^node_modules\//, '')
      const classification = classifyLicense('npm', name, pkg.license)
      return {
        ecosystem: 'npm',
        name,
        version: pkg.version ?? null,
        license: pkg.license ?? null,
        licenseFile: null,
        status: classification.status,
        reason: classification.reason,
        direct: rootDeps.has(name),
        dev: pkg.dev === true,
        source: packagePath,
        repository: typeof pkg.resolved === 'string' ? pkg.resolved : null,
      }
    })
    .sort(compareInventoryItems)
}

function nativeInventory() {
  return (policy.nativeNotices ?? []).map((item) => ({
    ecosystem: 'native',
    name: item.name,
    version: null,
    license: item.license,
    licenseFile: null,
    status: 'review',
    reason: item.review,
    direct: false,
    source: item.source,
    repository: null,
  }))
}

function compareInventoryItems(left, right) {
  return `${left.ecosystem}:${left.name}:${left.version ?? ''}`
    .localeCompare(`${right.ecosystem}:${right.name}:${right.version ?? ''}`)
}

function summarize(items) {
  const summary = {
    allow: 0,
    review: 0,
    fail: 0,
  }
  for (const item of items) {
    summary[item.status] += 1
  }
  return summary
}

function markdownSummary(cargoItems, npmItems, nativeItems) {
  const allItems = [...cargoItems, ...npmItems, ...nativeItems]
  const summary = summarize(allItems)
  const reviewItems = allItems.filter((item) => item.status === 'review')
  const failedItems = allItems.filter((item) => item.status === 'fail')

  const lines = [
    '# Dependency License Summary',
    '',
    'Generated by `npm run licenses:generate`.',
    '',
    '## Totals',
    '',
    `- Allowed: ${summary.allow}`,
    `- Review required: ${summary.review}`,
    `- Failed: ${summary.fail}`,
    '',
    '## Review Required',
    '',
  ]

  if (reviewItems.length === 0) {
    lines.push('- None')
  } else {
    for (const item of reviewItems) {
      lines.push(`- ${item.ecosystem}: ${item.name}${item.version ? `@${item.version}` : ''} (${item.license ?? 'unknown'}) - ${item.reason}`)
    }
  }

  lines.push('', '## Failures', '')
  if (failedItems.length === 0) {
    lines.push('- None')
  } else {
    for (const item of failedItems) {
      lines.push(`- ${item.ecosystem}: ${item.name}${item.version ? `@${item.version}` : ''} (${item.license ?? 'unknown'}) - ${item.reason}`)
    }
  }

  lines.push(
    '',
    '## Native/Vendored Notes',
    '',
    '- Cargo metadata does not fully model native vendored libssh/OpenSSL obligations.',
    '- Keep `THIRD_PARTY_LICENSES.md` as the hand-reviewed release notice source until bundle resource integration is complete.',
    '',
  )

  return `${lines.join('\n')}\n`
}

function writeGeneratedReports(cargoItems, npmItems, nativeItems) {
  mkdirSync(generatedDir, { recursive: true })
  writeFileSync(
    path.join(generatedDir, 'cargo-licenses.json'),
    `${JSON.stringify(cargoItems, null, 2)}\n`,
  )
  writeFileSync(
    path.join(generatedDir, 'npm-licenses.json'),
    `${JSON.stringify(npmItems, null, 2)}\n`,
  )
  writeFileSync(
    path.join(generatedDir, 'native-notices.json'),
    `${JSON.stringify(nativeItems, null, 2)}\n`,
  )
  writeFileSync(
    path.join(generatedDir, 'dependency-license-summary.md'),
    markdownSummary(cargoItems, npmItems, nativeItems),
  )
}

function printFailures(items) {
  const failed = items.filter((item) => item.status === 'fail')
  if (failed.length === 0) {
    return
  }

  console.error('License audit failed for these dependencies:')
  for (const item of failed) {
    console.error(`- ${item.ecosystem}: ${item.name}${item.version ? `@${item.version}` : ''} (${item.license ?? 'unknown'}) - ${item.reason}`)
  }
  console.error('')
  console.error('Required action: add a justified package exception to docs/legal/license-policy.json, add the license to allowedLicenses/reviewLicenses after review, or replace the dependency.')
}

const cargoItems = cargoInventory()
const npmItems = npmInventory()
const nativeItems = nativeInventory()
const allItems = [...cargoItems, ...npmItems, ...nativeItems]
const summary = summarize(allItems)

if (shouldGenerate) {
  writeGeneratedReports(cargoItems, npmItems, nativeItems)
}

console.log(`License audit: ${summary.allow} allowed, ${summary.review} review-required, ${summary.fail} failed.`)

if (shouldCheck && summary.fail > 0) {
  printFailures(allItems)
  process.exit(1)
}
