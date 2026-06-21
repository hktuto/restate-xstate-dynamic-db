#!/usr/bin/env node
/**
 * Apply YAML frontmatter to every Markdown file under docs/.
 *
 * Run from repo root:
 *   node docs/scripts/apply-frontmatter.js
 *
 * The script is idempotent: files that already have frontmatter are skipped
 * unless --force is passed.
 */

const fs = require('fs')
const path = require('path')

const DOCS_ROOT = path.resolve(__dirname, '..')
const FORCE = process.argv.includes('--force')

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      if (entry === '.obsidian' || entry === 'scripts' || entry === '90-Templates') continue
      walk(full, files)
    } else if (stat.isFile() && entry.endsWith('.md')) {
      files.push(full)
    }
  }
  return files
}

function extractFirstHeading(content) {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : ''
}

function parseExistingFrontmatter(content) {
  const trimmed = content.trimStart()
  if (!trimmed.startsWith('---\n') && !trimmed.startsWith('---\r\n')) return null
  const end = trimmed.search(/\n---\r?\n/)
  if (end === -1) return null
  const block = trimmed.slice(4, end)
  const result = {}
  let currentKey = null
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (line.trim() === '') continue
    const arrayItem = line.match(/^\s*-\s+(.+)$/)
    if (arrayItem) {
      if (currentKey) {
        if (!Array.isArray(result[currentKey])) result[currentKey] = []
        result[currentKey].push(arrayItem[1].trim())
      }
      continue
    }
    const keyValue = line.match(/^\s*([a-zA-Z0-9_]+):\s*(.*)$/)
    if (keyValue) {
      currentKey = keyValue[1].trim()
      const value = keyValue[2].trim()
      if (value === '') {
        result[currentKey] = []
      } else if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim()
        result[currentKey] = inner ? inner.split(',').map(s => s.trim()) : []
      } else {
        result[currentKey] = value
      }
    }
  }
  return result
}

function frontmatterEqual(a, b) {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (!keysB.includes(key)) return false
    const va = a[key]
    const vb = b[key]
    if (Array.isArray(va) && Array.isArray(vb)) {
      if (va.length !== vb.length) return false
      for (let i = 0; i < va.length; i++) {
        if (va[i] !== vb[i]) return false
      }
    } else if (va !== vb) {
      return false
    }
  }
  return true
}

function extractTags(content) {
  const tags = new Set()
  const matches = content.matchAll(/#([a-zA-Z0-9_/-]+)/g)
  for (const m of matches) tags.add(m[1])
  return Array.from(tags)
}

function tagValue(tags, prefix) {
  const found = tags.find(t => t.startsWith(prefix + '/'))
  return found ? found.slice(prefix.length + 1) : undefined
}

function extractWikilinks(content) {
  const links = new Set()
  const matches = content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)
  for (const m of matches) links.add(`[[${m[1].trim()}]]`)
  return Array.from(links)
}

function inferStatus(tags, defaults, relPath, existingStatus) {
  if (existingStatus) return existingStatus
  const override = STATUS_OVERRIDES[relPath]
  if (override) return override
  const statusTag = tagValue(tags, 'status')
  if (statusTag === 'active') return 'in-progress'
  if (statusTag === 'blocker') return 'in-progress'
  if (statusTag === 'deprecated') return 'idle'
  if (statusTag === 'idea') return 'planned'
  return statusTag || defaults.status
}

const AREA_OVERRIDES = {
  '00-Atlas/Tags.md': 'docs',
  '30-Apps/Health Monitor/Overview.md': 'ops',
  '50-Features/User Management.md': 'admin',
  '50-Features/Company Management.md': 'admin',
  '50-Features/Tenant Authentication & Authorization.md': 'web',
  '50-Features/Admin Health Monitor.md': 'admin',
}

function inferArea(relPath, tags) {
  const override = AREA_OVERRIDES[relPath]
  if (override) return override
  const areaTag = tagValue(tags, 'area')
  if (areaTag) return areaTag
  if (relPath.includes('10-Project')) return 'architecture'
  if (relPath.includes('20-Architecture')) return 'architecture'
  if (relPath.includes('30-Apps/Web')) return 'web'
  if (relPath.includes('30-Apps/Admin')) return 'admin'
  if (relPath.includes('30-Apps/Workflow Runtime')) return 'runtime'
  if (relPath.includes('40-Packages')) return 'architecture'
  if (relPath.includes('50-Features')) return 'workflow'
  if (relPath.includes('60-Development')) return 'docs'
  if (relPath.includes('70-Operations')) return 'ops'
  return 'docs'
}

function inferType(relPath) {
  if (relPath.includes('90-Templates')) return 'template'
  if (relPath.includes('20-Architecture/Decision Log')) return 'adr'
  if (relPath.includes('30-Apps')) return 'app'
  if (relPath.includes('40-Packages')) return 'package'
  if (relPath.includes('50-Features')) return 'feature'
  if (relPath.includes('60-Development') || relPath.includes('70-Operations')) return 'runbook'
  if (relPath.includes('00-Atlas')) {
    const base = path.basename(relPath, '.md').toLowerCase()
    if (['readme', 'dashboard', 'status board', 'project brief'].includes(base)) return 'index'
    return 'note'
  }
  if (relPath.includes('10-Project')) return 'project'
  return 'note'
}

function inferApp(relPath, type, title) {
  if (type === 'app') {
    if (relPath.includes('30-Apps/Web')) return ['web']
    if (relPath.includes('30-Apps/Admin')) return ['admin']
    if (relPath.includes('30-Apps/Workflow Runtime')) return ['runtime']
    if (relPath.includes('30-Apps/Health Monitor')) return ['health-monitor']
  }
  if (type === 'feature') {
    const t = title.toLowerCase()
    if (t.includes('admin health monitor')) return ['admin']
    if (t.includes('user management')) return ['admin', 'web']
    if (t.includes('company management')) return ['admin']
    if (t.includes('tenant authentication')) return ['web']
    if (t.includes('tenant permission')) return ['admin', 'web']
    if (t.includes('workflow designer')) return ['web', 'admin']
    if (t.includes('workflow engine')) return ['runtime']
    if (t.includes('workflow actions catalog')) return ['web', 'admin', 'runtime']
    if (t.includes('guards')) return ['web', 'admin', 'runtime']
  }
  if (type === 'package') {
    if (relPath.includes('db')) return undefined
    if (relPath.includes('shared')) return undefined
    if (relPath.includes('workflow-actions')) return undefined
    if (relPath.includes('workflow-editor-layer')) return undefined
  }
  return undefined
}

function inferPackage(relPath, type) {
  if (type !== 'package') return undefined
  if (relPath.includes('/db.md')) return 'db'
  if (relPath.includes('/shared.md')) return 'shared'
  if (relPath.includes('/workflow-actions.md')) return 'workflow-actions'
  if (relPath.includes('/workflow-editor-layer.md')) return 'workflow-editor-layer'
  return undefined
}

function inferDefaultStatus(type) {
  if (type === 'adr' || type === 'project') return 'done'
  if (type === 'feature') return 'planned'
  if (type === 'runbook') return 'in-progress'
  if (type === 'app' || type === 'package') return 'done'
  return 'in-progress'
}

// Manual status overrides so the vault reflects actual implementation state.
const STATUS_OVERRIDES = {
  '00-Atlas/README.md': 'done',
  '00-Atlas/Dashboard.md': 'in-progress',
  '00-Atlas/Documentation Conventions.md': 'in-progress',
  '00-Atlas/How to use this vault.md': 'done',
  '00-Atlas/Project Brief.md': 'in-progress',
  '00-Atlas/Status Board.md': 'in-progress',
  '00-Atlas/Tags.md': 'done',
  '10-Project/Vision.md': 'done',
  '10-Project/Goals & Non-Goals.md': 'done',
  '10-Project/Glossary.md': 'done',
  '10-Project/Roadmap.md': 'in-progress',
  '20-Architecture/System Overview.md': 'done',
  '20-Architecture/Technology Stack.md': 'done',
  '20-Architecture/Monorepo Layout.md': 'done',
  '20-Architecture/Data Model.md': 'done',
  '20-Architecture/Authentication & Authorization.md': 'in-progress',
  '20-Architecture/Multi-tenancy.md': 'done',
  '20-Architecture/Workflow Runtime.md': 'done',
  '20-Architecture/Decision Log/ADR-001 SurrealDB as primary database.md': 'done',
  '20-Architecture/Decision Log/ADR-002 Restate for workflow runtime.md': 'done',
  '20-Architecture/Decision Log/ADR-003 Nuxt layers for workflow editor.md': 'done',
  '20-Architecture/Decision Log/ADR-004 Bcrypt for password hashing.md': 'done',
  '30-Apps/Web App/Overview.md': 'done',
  '30-Apps/Admin App/Overview.md': 'done',
  '30-Apps/Workflow Runtime/Overview.md': 'done',
  '30-Apps/Health Monitor/Overview.md': 'done',
  '40-Packages/db.md': 'done',
  '40-Packages/shared.md': 'done',
  '40-Packages/workflow-actions.md': 'done',
  '40-Packages/workflow-editor-layer.md': 'done',
  '50-Features/Admin Health Monitor.md': 'done',
  '50-Features/User Management.md': 'planned',
  '50-Features/Company Management.md': 'done',
  '50-Features/Tenant Authentication & Authorization.md': 'in-progress',
  '50-Features/Tenant Permission System.md': 'done',
  '50-Features/Workflow Designer.md': 'done',
  '50-Features/Workflow Engine.md': 'planned',
  '50-Features/Workflow Actions Catalog.md': 'planned',
  '50-Features/Guards & Conditions.md': 'planned',
  '60-Development/Getting Started.md': 'done',
  '60-Development/Environment Setup.md': 'done',
  '60-Development/Running locally.md': 'done',
  '60-Development/Scripts & Commands.md': 'done',
  '60-Development/Testing.md': 'done',
  '70-Operations/Docker Compose.md': 'done',
  '70-Operations/SurrealDB Maintenance.md': 'planned',
  '70-Operations/Restate Operations.md': 'planned',
  '70-Operations/Troubleshooting.md': 'done',
  '90-Templates/ADR Template.md': 'done',
  '90-Templates/Feature Note Template.md': 'done',
  '90-Templates/Runbook Template.md': 'done',
  '90-Templates/Bug Report Template.md': 'done',
  'superpowers/plans/2026-06-16-test-db-package.md': 'done',
}

function inferStatus(tags, defaults, relPath) {
  const override = STATUS_OVERRIDES[relPath]
  if (override) return override
  const statusTag = tagValue(tags, 'status')
  if (statusTag === 'active') return 'in-progress'
  if (statusTag === 'blocker') return 'in-progress'
  if (statusTag === 'deprecated') return 'idle'
  if (statusTag === 'idea') return 'planned'
  return statusTag || defaults.status
}

function buildFrontmatter(file, relPath, existing) {
  const raw = fs.readFileSync(file, 'utf8')
  const title = extractFirstHeading(raw) || path.basename(file, '.md')
  const tags = extractTags(raw)
  const type = inferType(relPath)
  const area = inferArea(relPath, tags)
  const status = inferStatus(tags, { status: inferDefaultStatus(type) }, relPath, existing?.status)
  const app = inferApp(relPath, type, title)
  const pkg = inferPackage(relPath, type)
  const related = extractWikilinks(raw)
  const today = new Date().toISOString().split('T')[0]

  const fm = {
    title,
    type,
    status,
    area,
    created: existing?.created || today,
    updated: today,
  }

  if (app) fm.app = app
  if (pkg) fm.package = pkg
  if (related.length) fm.related = related

  return fm
}

function stringifyFrontmatter(obj) {
  const lines = Object.entries(obj).map(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length === 0) return `${key}: []`
      return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`
    }
    return `${key}: ${value}`
  })
  return `---\n${lines.join('\n')}\n---\n`
}

function startsWithFrontmatter(content) {
  const trimmed = content.trimStart()
  return trimmed.startsWith('---\n') || trimmed.startsWith('---\r\n')
}

function hasFrontmatter(content) {
  return startsWithFrontmatter(content)
}

function stripOneFrontmatter(content) {
  const trimmed = content.trimStart()
  if (!startsWithFrontmatter(trimmed)) return content
  const end = trimmed.search(/\n---\r?\n/)
  if (end === -1) return content
  return trimmed.slice(end + 4).trimStart().replace(/^\r?\n/, '')
}

function stripExistingFrontmatter(content) {
  let previous
  let current = content
  do {
    previous = current
    current = stripOneFrontmatter(previous)
  } while (current !== previous)
  return current
}

function protectCodeBlocks(content) {
  const placeholders = []
  const protectedContent = content
    .replace(/```[\s\S]*?```/g, (m) => {
      placeholders.push(m)
      return `\u0000CODEBLOCK${placeholders.length - 1}\u0000`
    })
    .replace(/`[^`]+`/g, (m) => {
      placeholders.push(m)
      return `\u0000INLINE${placeholders.length - 1}\u0000`
    })
  return { protectedContent, placeholders }
}

function restoreCodeBlocks(content, placeholders) {
  return content.replace(/\u0000(CODEBLOCK|INLINE)(\d+)\u0000/g, (_, __, index) => placeholders[Number(index)])
}

function stripInlineTags(content) {
  const { protectedContent, placeholders } = protectCodeBlocks(content)
  // Remove standalone classification tags that are now in frontmatter
  let cleaned = protectedContent
  cleaned = cleaned.replace(/(^|\s)#status\/[a-z-]+(\s|$)/g, '$1$2')
  cleaned = cleaned.replace(/(^|\s)#area\/[a-z-]+(\s|$)/g, '$1$2')
  cleaned = cleaned.replace(/(^|\s)#type\/[a-z-]+(\s|$)/g, '$1$2')
  // Collapse multiple blank lines left by tag removal
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  // Remove blank lines immediately after the first H1 heading
  cleaned = cleaned.replace(/^(#\s+.+\n)(?:\s*\n)+/, '$1\n')
  return restoreCodeBlocks(cleaned, placeholders)
}

function processFile(file) {
  const relPath = path.relative(DOCS_ROOT, file).replace(/\\/g, '/')
  let content = fs.readFileSync(file, 'utf8')
  const existing = parseExistingFrontmatter(content)

  if (hasFrontmatter(content) && !FORCE) {
    console.log(`skip  ${relPath}`)
    return
  }

  const fm = buildFrontmatter(file, relPath, existing)

  // If the file already has frontmatter and it would not change (ignoring
  // updated), leave it alone so created/updated dates and the git diff stay clean.
  if (existing) {
    const compareFm = { ...fm, updated: existing.updated }
    if (frontmatterEqual(compareFm, existing)) {
      console.log(`skip  ${relPath}`)
      return
    }
  }

  content = stripExistingFrontmatter(content)
  content = stripInlineTags(content)
  const newContent = stringifyFrontmatter(fm) + '\n' + content.trimStart()
  fs.writeFileSync(file, newContent, 'utf8')
  console.log(`write ${relPath}`)
}

function main() {
  const files = walk(DOCS_ROOT)
  for (const file of files) {
    processFile(file)
  }
  console.log(`\nProcessed ${files.length} files.`)
}

main()
