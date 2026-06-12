#!/usr/bin/env node
/**
 * Downloads the official MITRE ATT&CK enterprise STIX bundle and preprocesses
 * it into the compact JSON files the game ships with:
 *
 *   src/data/matrix.json        - tactics (column order) + techniques
 *   public/data/procedures.json - cleaned procedure examples with answers
 *   public/data/groups.json     - groups with enough procedures for incident mode
 *
 * Usage: node scripts/update-data.mjs [--cached]
 *   --cached  reuse scripts/.cache/enterprise-attack.json instead of downloading
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, 'scripts', '.cache', 'enterprise-attack.json')
const URL = 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json'
const REDACTED = '[REDACTED]'

function fail(msg) {
  console.error(`SELF-CHECK FAILED: ${msg}`)
  process.exit(1)
}

// ---------------------------------------------------------------- download

async function loadBundle() {
  if (process.argv.includes('--cached') && existsSync(CACHE)) {
    console.log(`Using cached bundle ${CACHE}`)
    return JSON.parse(readFileSync(CACHE, 'utf8'))
  }
  console.log(`Downloading ${URL} ...`)
  const res = await fetch(URL)
  if (!res.ok) fail(`download failed: HTTP ${res.status}`)
  const text = await res.text()
  mkdirSync(dirname(CACHE), { recursive: true })
  writeFileSync(CACHE, text)
  console.log(`Downloaded ${(text.length / 1e6).toFixed(1)} MB (cached for --cached)`)
  return JSON.parse(text)
}

// ---------------------------------------------------------------- helpers

const attackId = (obj) =>
  obj.external_references?.find((r) => r.source_name === 'mitre-attack')?.external_id ?? null

const isActive = (obj) => obj.revoked !== true && obj.x_mitre_deprecated !== true

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const TECH_URL_RE = /attack\.mitre\.org\/techniques\/(T\d{4})(?:\/(\d{3}))?/

// ---------------------------------------------------------------- main

const bundle = await loadBundle()
const objects = bundle.objects
const byId = new Map(objects.map((o) => [o.id, o]))

// --- tactics, in matrix column order
const matrixObj = objects.find((o) => o.type === 'x-mitre-matrix' && isActive(o))
if (!matrixObj) fail('no x-mitre-matrix object found')
const tactics = matrixObj.tactic_refs
  .map((ref) => byId.get(ref))
  .filter((t) => t && isActive(t))
  .map((t) => ({ id: attackId(t), shortname: t.x_mitre_shortname, name: t.name }))
if (tactics.length < 12 || tactics.length > 18)
  fail(`expected 12-18 tactics, got ${tactics.length}`)

// --- techniques: all attack-patterns (incl. revoked) for leak detection,
//     active enterprise ones for the matrix
const allPatterns = objects.filter((o) => o.type === 'attack-pattern')
const stixToTid = new Map() // every attack-pattern, active or not
for (const p of allPatterns) {
  const tid = attackId(p)
  if (tid) stixToTid.set(p.id, tid)
}

const activeTechs = new Map() // tid -> {id, name, tactics, parent}
for (const p of allPatterns) {
  if (!isActive(p)) continue
  if (!(p.x_mitre_domains ?? []).includes('enterprise-attack')) continue
  const tid = attackId(p)
  if (!tid) continue
  const isSub = p.x_mitre_is_subtechnique === true
  activeTechs.set(tid, {
    id: tid,
    name: p.name,
    tactics: (p.kill_chain_phases ?? [])
      .filter((k) => k.kill_chain_name === 'mitre-attack')
      .map((k) => k.phase_name),
    parent: isSub ? tid.split('.')[0] : null,
  })
}
// drop subs whose parent is gone
for (const [tid, t] of [...activeTechs]) {
  if (t.parent && !activeTechs.has(t.parent)) {
    console.warn(`WARN: dropping ${tid} (${t.name}) - parent ${t.parent} not active`)
    activeTechs.delete(tid)
  }
}
if (activeTechs.size < 600 || activeTechs.size > 800)
  fail(`expected 600-800 techniques, got ${activeTechs.size}`)

const childrenOf = new Map() // parent tid -> [sub tids]
for (const t of activeTechs.values()) {
  if (t.parent) {
    if (!childrenOf.has(t.parent)) childrenOf.set(t.parent, [])
    childrenOf.get(t.parent).push(t.id)
  }
}

// --- revoked-by remapping (revoked technique stix id -> replacement tid)
const revokedBy = new Map()
for (const o of objects) {
  if (o.type === 'relationship' && o.relationship_type === 'revoked-by') {
    revokedBy.set(o.source_ref, o.target_ref)
  }
}
function resolveTechnique(stixRef) {
  let obj = byId.get(stixRef)
  if (!obj || obj.type !== 'attack-pattern') return null
  if (!isActive(obj) && revokedBy.has(obj.id)) obj = byId.get(revokedBy.get(obj.id))
  if (!obj || !isActive(obj)) return null
  const tid = attackId(obj)
  return activeTechs.has(tid) ? tid : null
}

// --- sources: groups, software, campaigns
const sources = new Map() // stix id -> {name, kind, gid, aliases}
for (const o of objects) {
  if (!isActive(o)) continue
  if (o.type === 'intrusion-set')
    sources.set(o.id, {
      name: o.name,
      kind: 'group',
      gid: attackId(o),
      aliases: (o.aliases ?? []).filter((a) => a !== o.name),
    })
  else if (o.type === 'malware' || o.type === 'tool')
    sources.set(o.id, { name: o.name, kind: 'software' })
  else if (o.type === 'campaign')
    sources.set(o.id, { name: o.name, kind: 'campaign' })
}

// ---------------------------------------------------------------- cleaning

function stripCitations(s) {
  return s.replace(/\(Citation:[^)]*\)/g, '')
}

/** Replace markdown links: technique links in `family` -> [REDACTED], rest -> anchor text. */
function resolveLinks(s, family) {
  return s.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, text, url) => {
    const m = url.match(TECH_URL_RE)
    if (m) {
      const tid = m[2] ? `${m[1]}.${m[2]}` : m[1]
      if (family.has(tid)) return REDACTED
    }
    return text
  })
}

/** Whole-word redaction of answer technique names (>= 4 chars). Returns [text, replacedChars]. */
function redactNames(s, names) {
  let replaced = 0
  for (const name of names) {
    if (name.length < 4) continue
    const re = new RegExp(`\\b${escapeRe(name)}\\b`, 'gi')
    s = s.replace(re, (m) => {
      replaced += m.length
      return REDACTED
    })
  }
  // collapse adjacent duplicate redactions like "[REDACTED] ([REDACTED])"
  s = s.replace(/\[REDACTED\]\s*\(\s*\[REDACTED\]\s*\)/g, REDACTED)
  return [s, replaced]
}

function tidy(s) {
  return decodeEntities(s)
    .replace(/<\/?code>/g, '`')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(s, max = 1500) {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const end = cut.lastIndexOf('. ')
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut) + '…'
}

/** Family of tids whose links/names give the answer away: answers, parents, children. */
function answerFamily(answers) {
  const fam = new Set()
  for (const a of answers) {
    fam.add(a)
    const t = activeTechs.get(a)
    if (t?.parent) fam.add(t.parent)
    for (const c of childrenOf.get(a) ?? []) fam.add(c)
  }
  return fam
}

/** Names to redact verbatim: answer names + parent names of sub answers. */
function answerNames(answers) {
  const names = new Set()
  for (const a of answers) {
    const t = activeTechs.get(a)
    if (!t) continue
    names.add(t.name)
    if (t.parent) names.add(activeTechs.get(t.parent).name)
  }
  return names
}

// ---------------------------------------------------------------- pass 2: procedures

const dropped = { unresolved: 0, short: 0, overRedacted: 0, noSource: 0 }
const merged = new Map() // dedup key -> {relId, desc, answers:Set, srcRef}

for (const o of objects) {
  if (o.type !== 'relationship' || o.relationship_type !== 'uses') continue
  if (!isActive(o)) continue
  if (!o.target_ref?.startsWith('attack-pattern--')) continue
  const desc = o.description
  if (!desc || desc.length < 50) continue
  const tid = resolveTechnique(o.target_ref)
  if (!tid) {
    dropped.unresolved++
    continue
  }
  if (!sources.has(o.source_ref)) {
    dropped.noSource++
    continue
  }
  // dedup key: answer-independent normalization (links -> anchor text)
  const key = tidy(resolveLinks(stripCitations(desc), new Set())).toLowerCase()
  if (!merged.has(key)) {
    merged.set(key, { relId: o.id, desc, answers: new Set(), srcRef: o.source_ref })
  }
  merged.get(key).answers.add(tid)
}

const items = []
const entries = [...merged.values()].sort((a, b) => a.relId.localeCompare(b.relId))
for (const e of entries) {
  const answers = [...e.answers].sort()
  let text = stripCitations(e.desc)
  text = resolveLinks(text, answerFamily(answers))
  const preLen = text.length
  let replaced
  ;[text, replaced] = redactNames(text, answerNames(answers))
  text = truncate(tidy(text))
  if (replaced / preLen > 0.3) {
    dropped.overRedacted++
    continue
  }
  if (text.length < 60) {
    dropped.short++
    continue
  }
  const src = sources.get(e.srcRef)
  items.push({ i: items.length, t: text, a: answers, s: src.name, k: src.kind, _src: e.srcRef })
}

// ---------------------------------------------------------------- groups for incident mode

const groups = []
for (const [stixId, src] of sources) {
  if (src.kind !== 'group') continue
  const procIds = items.filter((it) => it._src === stixId).map((it) => it.i)
  if (procIds.length < 6) continue
  const tacticSet = new Set()
  for (const pid of procIds) {
    for (const a of items[pid].a) {
      const t = activeTechs.get(a)
      if (t.tactics[0]) tacticSet.add(t.tactics[0])
    }
  }
  if (tacticSet.size < 3) continue
  groups.push({ id: src.gid, name: src.name, aliases: src.aliases, procIds })
}
groups.sort((a, b) => a.id.localeCompare(b.id))

for (const it of items) delete it._src

// ---------------------------------------------------------------- self-checks

for (const it of items) {
  for (const a of it.a) if (!activeTechs.has(a)) fail(`item ${it.i} has unknown technique ${a}`)
  if (it.t.includes('(Citation:')) fail(`item ${it.i} still contains a citation`)
  if (it.t.includes('attack.mitre.org/techniques')) fail(`item ${it.i} leaks a technique URL`)
}
for (const g of groups)
  for (const pid of g.procIds)
    if (pid < 0 || pid >= items.length) fail(`group ${g.id} has out-of-range procId ${pid}`)
if (items.length < 10000) fail(`expected >=10k procedure items, got ${items.length}`)

// ---------------------------------------------------------------- write outputs

const techniques = [...activeTechs.values()].sort((a, b) => a.id.localeCompare(b.id))
const matrixOut = JSON.stringify({ tactics, techniques }, null, 1)
const procsOut = JSON.stringify({ v: 1, items })
const groupsOut = JSON.stringify({ groups })

mkdirSync(join(ROOT, 'src', 'data'), { recursive: true })
mkdirSync(join(ROOT, 'public', 'data'), { recursive: true })
writeFileSync(join(ROOT, 'src', 'data', 'matrix.json'), matrixOut)
writeFileSync(join(ROOT, 'public', 'data', 'procedures.json'), procsOut)
writeFileSync(join(ROOT, 'public', 'data', 'groups.json'), groupsOut)

const kb = (s) => `${(s.length / 1024).toFixed(0)} KB`
console.log('')
console.log('Summary')
console.log('-------')
console.log(`tactics:          ${tactics.length}`)
console.log(`techniques:       ${techniques.length} (${techniques.filter((t) => t.parent).length} sub-techniques)`)
console.log(`procedure items:  ${items.length}`)
console.log(`  multi-answer:   ${items.filter((it) => it.a.length > 1).length}`)
console.log(`  dropped:        ${JSON.stringify(dropped)}`)
console.log(`incident groups:  ${groups.length}`)
console.log(`matrix.json:      ${kb(matrixOut)}`)
console.log(`procedures.json:  ${kb(procsOut)}`)
console.log(`groups.json:      ${kb(groupsOut)}`)
console.log('\nAll self-checks passed.')
