import type { GroupInfo, ProcedureItem } from '../types'

interface Dataset {
  procedures: ProcedureItem[]
  groups: GroupInfo[]
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
