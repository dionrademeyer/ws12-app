// Copy rules from CLAUDE.md: no ampersand character and no em or en dashes in learner-facing
// text and docs, and no em or en dashes anywhere in the source.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const dashes = /[\u2013\u2014]/
const ampersand = /&/
const textFile = /\.(md|json|html|txt)$/
// docs/build-brief.md is Didi's original Master Build Prompt and is kept word for word.
const skipped = new Set(['package.json', 'package-lock.json', 'docs/build-brief.md'])

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)
  .filter((file) => !skipped.has(file) && !file.startsWith('tsconfig'))

const problems = []
for (const file of files) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  text.split('\n').forEach((line, index) => {
    if (dashes.test(line)) problems.push(`${file}:${index + 1}: em or en dash`)
    if (textFile.test(file) && ampersand.test(line))
      problems.push(`${file}:${index + 1}: ampersand`)
  })
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`Copy check passed on ${files.length} files.`)
