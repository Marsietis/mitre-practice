import type { D3DrillItem, GroupInfo, ProcedureItem } from '../types'

interface Dataset {
  procedures: ProcedureItem[]
  groups: GroupInfo[]
}

interface D3Dataset {
  items: D3DrillItem[]
  map: Record<string, string[]>
}

let cached: Promise<Dataset> | null = null

export function loadDataset(): Promise<Dataset> {
  if (!cached) {
    cached = (async () => {
      const base = import.meta.env.BASE_URL
      const [procRes, groupRes] = await Promise.all([
        fetch(`${base}data/procedures.json`),
        fetch(`${base}data/groups.json`),
      ])
      if (!procRes.ok || !groupRes.ok) throw new Error('failed to load dataset')
      const procJson = await procRes.json()
      const groupJson = await groupRes.json()
      if (procJson.v !== 1 || !Array.isArray(procJson.items) || procJson.items.length === 0) {
        throw new Error('unexpected procedures.json format')
      }
      return { procedures: procJson.items as ProcedureItem[], groups: groupJson.groups as GroupInfo[] }
    })()
    cached.catch(() => {
      cached = null
    })
  }
  return cached
}

let cachedD3: Promise<D3Dataset> | null = null

export function loadD3Dataset(): Promise<D3Dataset> {
  if (!cachedD3) {
    cachedD3 = (async () => {
      const base = import.meta.env.BASE_URL
      const [drillRes, mapRes] = await Promise.all([
        fetch(`${base}data/d3drill.json`),
        fetch(`${base}data/d3map.json`),
      ])
      if (!drillRes.ok || !mapRes.ok) throw new Error('failed to load D3FEND dataset')
      const drillJson = await drillRes.json()
      const mapJson = await mapRes.json()
      if (drillJson.v !== 1 || !Array.isArray(drillJson.items) || drillJson.items.length === 0) {
        throw new Error('unexpected d3drill.json format')
      }
      if (mapJson.v !== 1 || typeof mapJson.map !== 'object') {
        throw new Error('unexpected d3map.json format')
      }
      return { items: drillJson.items as D3DrillItem[], map: mapJson.map as Record<string, string[]> }
    })()
    cachedD3.catch(() => {
      cachedD3 = null
    })
  }
  return cachedD3
}
