#!/usr/bin/env node
/**
 * Downloads the MITRE D3FEND matrix + per-technique knowledge base articles
 * and preprocesses them into the compact JSON files the D3FEND modes ship with:
 *
 *   src/data/d3fend-matrix.json - tactics (column order) + techniques
 *   public/data/d3drill.json    - redacted definition-drill items with answers
 *   public/data/d3map.json      - ATT&CK technique id -> D3FEND technique ids
 *
 * Usage: node scripts/update-d3fend.mjs [--cached] [--force]
 *   --cached  use scripts/.cache/d3fend/ exclusively, no network
 *   --force   refetch per-technique files even if cached
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_DIR = join(ROOT, 'scripts', '.cache', 'd3fend')
const MATRIX_URL = 'https://d3fend.mitre.org/api/matrix.json'
const TECH_URL = (ref) => `https://d3fend.mitre.org/api/technique/${ref}.json`
const REDACTED = '[REDACTED]'
const CACHED_ONLY = process.argv.includes('--cached')
const FORCE = process.argv.includes('--force')

function fail(msg) {
  console.error(`SELF-CHECK FAILED: ${msg}`)
  process.exit(1)
}

// ---------------------------------------------------------------- download

mkdirSync(CACHE_DIR, { recursive: true })

async function fetchJson(url, cacheFile, { reuse }) {
  const path = join(CACHE_DIR, cacheFile)
  if ((CACHED_ONLY || reuse) && existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8'))
  }
  if (CACHED_ONLY) fail(`--cached but ${path} is missing`)
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      writeFileSync(path, text)
      return JSON.parse(text)
    } catch (e) {
      if (attempt >= 1) fail(`download failed for ${url}: ${e.message}`)
      console.warn(`WARN: retrying ${url} (${e.message})`)
    }
  }
}

/** Run tasks with limited concurrency, preserving order of results. */
async function pool(tasks, limit = 8) {
  const results = new Array(tasks.length)
  let next = 0
  async function worker() {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

// ---------------------------------------------------------------- matrix tree

const matrixTree = await fetchJson(MATRIX_URL, 'matrix.json', { reuse: false })
if (!Array.isArray(matrixTree) || matrixTree.length !== 7)
  fail(`expected 7 tactic roots, got ${Array.isArray(matrixTree) ? matrixTree.length : typeof matrixTree}`)

const tactics = [...matrixTree]
  .sort((a, b) => Number(a['d3f:display-order'] ?? 0) - Number(b['d3f:display-order'] ?? 0))
  .map((t) => ({
    id: t['@id'].replace(/^d3f:/, ''),
    shortname: t['rdfs:label'].toLowerCase(),
    name: t['rdfs:label'],
  }))

const techs = new Map() // D3 id -> {id, name, tactics, parent, uri, base?, row?, definition, children: []}
const skipped = []

function walk(node, depth, tacticShort, parentId, rowId) {
  const id = node['d3f:d3fend-id']
  if (depth > 0 && !id) {
    skipped.push(node['@id'])
    return
  }
  if (depth > 0) {
    const t = {
      id,
      name: node['rdfs:label'],
      tactics: [tacticShort],
      parent: parentId,
      uri: node['@id'].replace(/^d3f:/, ''),
      definition: node['d3f:definition'] ?? '',
      children: [],
    }
    if (depth === 1) t.base = true
    if (depth >= 3) t.row = rowId
    techs.set(id, t)
    if (parentId) techs.get(parentId).children.push(id)
  }
  const childRow = depth >= 2 ? (rowId ?? id) : null
  for (const child of node.children ?? []) {
    walk(child, depth + 1, tacticShort, depth > 0 ? id : null, childRow)
  }
}
for (const root of matrixTree) walk(root, 0, root['rdfs:label'].toLowerCase(), null, null)

if (skipped.length > 3) fail(`${skipped.length} nodes without a d3fend-id: ${skipped.join(', ')}`)
if (skipped.length) console.warn(`WARN: skipped id-less nodes: ${skipped.join(', ')}`)
if (techs.size < 250 || techs.size > 300) fail(`expected 250-300 techniques, got ${techs.size}`)

const labelToId = new Map([...techs.values()].map((t) => [t.name.toLowerCase(), t.id]))

// ---------------------------------------------------------------- per-technique pages

const techList = [...techs.values()]
const pages = await pool(
  techList.map((t) => () => fetchJson(TECH_URL(`d3f:${t.uri}`), `${t.id}.json`, { reuse: !FORCE })),
)

// ---------------------------------------------------------------- cleaning

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Strip markdown structure: headings, links/images -> anchor text, emphasis, code fences. */
function stripMarkdown(s) {
  return s
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/^[-*]\s+/gm, '')
}

function tidy(s) {
  return s.replace(/<\/?[a-z][^>]*>/gi, '').replace(/\s+/g, ' ').trim()
}

function truncate(s, max = 1200) {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const end = cut.lastIndexOf('. ')
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut) + '…'
}

/** Redaction of technique names (>= 4 chars), tolerating inflected endings and
 *  prefixed forms ("Asset Inventory" matches "asset inventorying";
 *  "Directional Network Link" matches "unidirectional network links"). */
function redactNames(s, names) {
  for (const name of names) {
    if (!name || name.length < 4) continue
    const re = new RegExp(`\\w*${escapeRe(name)}\\w*`, 'gi')
    s = s.replace(re, REDACTED)
  }
  return s
    .replace(/\[REDACTED\]\s*\(\s*\[REDACTED\]\s*\)/g, REDACTED)
    .replace(/(\[REDACTED\]\s*){2,}/g, `${REDACTED} `)
}

/** Body of the "## How it works" section of a kb article, if present. */
function howItWorks(kb) {
  const m = kb.match(/^##\s*How it works\s*$([\s\S]*?)(?=^##\s|\s*$(?![\s\S]))/im)
  return m ? m[1] : ''
}

// ---------------------------------------------------------------- drill items + mapping

const items = []
const map = new Map() // ATT&CK tid -> Set of D3 ids
const dropped = { short: 0 }
let kbCount = 0

for (let idx = 0; idx < techList.length; idx++) {
  const t = techList[idx]
  const page = pages[idx]

  // kb article lives on the graph node matching the technique class
  const graph = page?.description?.['@graph'] ?? []
  const node = graph.find((n) => n['@id'] === `d3f:${t.uri}`) ?? graph[0] ?? {}
  const kb = typeof node['d3f:kb-article'] === 'string' ? node['d3f:kb-article'] : ''
  if (kb) kbCount++

  // drill text: definition + "How it works"; redact this technique's family names
  const raw = `${t.definition} ${howItWorks(kb)}`
  const family = [t.name, t.parent ? techs.get(t.parent).name : '', ...t.children.map((c) => techs.get(c).name)]
  const text = truncate(redactNames(tidy(stripMarkdown(raw)), family))
  if (text.length >= 40) items.push({ i: items.length, t: text, a: [t.id] })
  else dropped.short++

  // invert def_to_off bindings; attribute each binding to its own def technique label
  for (const b of page?.def_to_off?.results?.bindings ?? []) {
    const offId = b.off_tech_id?.value
    if (!offId) continue
    const defLabel = b.def_tech_label?.value?.toLowerCase()
    const defId = (defLabel && labelToId.get(defLabel)) ?? t.id
    if (!map.has(offId)) map.set(offId, new Set())
    map.get(offId).add(defId)
  }
}

// D3FEND often maps only sub-techniques (e.g. T1003.001 but not T1003) or only
// the parent. Bake both fallbacks in: each id also inherits its parent's and
// its sub-techniques' direct mappings.
const effective = new Map()
for (const tid of map.keys()) {
  const union = new Set(map.get(tid))
  const parent = tid.includes('.') ? tid.split('.')[0] : null
  if (parent) for (const d of map.get(parent) ?? []) union.add(d)
  else
    for (const [sub, dids] of map) {
      if (sub.startsWith(`${tid}.`)) for (const d of dids) union.add(d)
    }
  effective.set(tid, union)
}
// parents that only exist via their subs (e.g. bare T1003)
for (const tid of [...map.keys()]) {
  const parent = tid.includes('.') ? tid.split('.')[0] : null
  if (!parent || effective.has(parent)) continue
  const union = new Set()
  for (const [sub, dids] of map) {
    if (sub === parent || sub.startsWith(`${parent}.`)) for (const d of dids) union.add(d)
  }
  effective.set(parent, union)
}

const mapOut = Object.fromEntries(
  [...effective.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [...v].sort()]),
)

// ---------------------------------------------------------------- self-checks

for (const t of techs.values()) {
  if (!/^D3F?-[A-Z0-9]+$/.test(t.id)) fail(`bad technique id ${t.id}`)
  if (t.parent && !techs.has(t.parent)) fail(`${t.id} has unknown parent ${t.parent}`)
  if (t.row && !techs.has(t.row)) fail(`${t.id} has unknown row ${t.row}`)
}
for (const [tid, dids] of Object.entries(mapOut)) {
  if (!/^T\d{4}(\.\d{3})?$/.test(tid)) fail(`bad ATT&CK id in map: ${tid}`)
  for (const d of dids) if (!techs.has(d)) fail(`map ${tid} references unknown ${d}`)
}
if (Object.keys(mapOut).length < 150)
  fail(`expected >=150 mapped ATT&CK techniques, got ${Object.keys(mapOut).length}`)
for (const it of items) {
  const name = techs.get(it.a[0]).name
  if (name.length >= 4 && it.t.toLowerCase().includes(name.toLowerCase()))
    fail(`item ${it.i} (${it.a[0]}) leaks its technique name "${name}"`)
}
if (items.length < 240) fail(`expected >=240 drill items, got ${items.length}`)

// ---------------------------------------------------------------- write outputs

const techniques = [...techs.values()]
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(({ definition, children, ...t }) => t)
const matrixOut = JSON.stringify({ tactics, techniques }, null, 1)
const drillOut = JSON.stringify({ v: 1, items })
const mapJson = JSON.stringify({ v: 1, map: mapOut })

writeFileSync(join(ROOT, 'src', 'data', 'd3fend-matrix.json'), matrixOut)
mkdirSync(join(ROOT, 'public', 'data'), { recursive: true })
writeFileSync(join(ROOT, 'public', 'data', 'd3drill.json'), drillOut)
writeFileSync(join(ROOT, 'public', 'data', 'd3map.json'), mapJson)

// counter-mode coverage report (informational)
const procPath = join(ROOT, 'public', 'data', 'procedures.json')
let coverageNote = 'procedures.json not found - skipped'
if (existsSync(procPath)) {
  const procs = JSON.parse(readFileSync(procPath, 'utf8')).items
  const usable = procs.filter((p) => {
    const union = new Set()
    for (const a of p.a) for (const d of mapOut[a] ?? mapOut[a.split('.')[0]] ?? []) union.add(d)
    return union.size >= 4
  })
  coverageNote = `${usable.length}/${procs.length} (${Math.round((usable.length / procs.length) * 100)}%)`
}

const kb = (s) => `${(s.length / 1024).toFixed(0)} KB`
console.log('')
console.log('Summary')
console.log('-------')
console.log(`tactics:            ${tactics.length}`)
console.log(`techniques:         ${techs.size} (${techniques.filter((t) => t.base).length} base, ${techniques.filter((t) => t.row).length} deep subs)`)
console.log(`kb articles:        ${kbCount}`)
console.log(`drill items:        ${items.length} (dropped: ${JSON.stringify(dropped)})`)
console.log(`mapped ATT&CK ids:  ${Object.keys(mapOut).length}`)
console.log(`counter-mode pool:  ${coverageNote}`)
console.log(`d3fend-matrix.json: ${kb(matrixOut)}`)
console.log(`d3drill.json:       ${kb(drillOut)}`)
console.log(`d3map.json:         ${kb(mapJson)}`)
console.log('\nAll self-checks passed.')
