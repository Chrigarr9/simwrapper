import { DataTableManager } from '../DataTableManager'
import { vi } from 'vitest'

describe('DataTableManager', () => {
  const mockConfig = {
    name: 'Test',
    dataset: 'test.csv',
    idColumn: 'id',
    visible: true,
  }

  let dtm: DataTableManager

  beforeEach(() => {
    dtm = new DataTableManager(mockConfig)
    // Directly set data for testing (skip actual file loading)
    ;(dtm as any).data = [
      { id: 1, name: 'Alice', mode: 'car' },
      { id: 2, name: 'Bob', mode: 'bike' },
      { id: 3, name: 'Charlie', mode: 'car' },
    ]
  })

  test('gets all data', () => {
    const data = dtm.getData()
    expect(data).toHaveLength(3)
  })

  test('gets row by ID', () => {
    const row = dtm.getRowById(2)
    expect(row).toEqual({ id: 2, name: 'Bob', mode: 'bike' })
  })

  test('returns undefined for non-existent ID', () => {
    const row = dtm.getRowById(999)
    expect(row).toBeUndefined()
  })

  test('gets multiple rows by IDs', () => {
    const rows = dtm.getRowsByIds(new Set([1, 3]))
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.name)).toEqual(['Alice', 'Charlie'])
  })

  test('returns empty array for non-matching IDs', () => {
    const rows = dtm.getRowsByIds(new Set([999, 888]))
    expect(rows).toHaveLength(0)
  })

  test('gets unique column values', () => {
    const values = dtm.getColumnValues('mode')
    expect(values).toEqual(['car', 'bike'])
  })

  test('gets unique column values with single value', () => {
    const values = dtm.getColumnValues('name')
    expect(values).toHaveLength(3)
  })

  test('gets config', () => {
    const config = dtm.getConfig()
    expect(config).toEqual(mockConfig)
  })

  test('gets ID column', () => {
    const idCol = dtm.getIdColumn()
    expect(idCol).toBe('id')
  })

  test('loads data from CSV file', async () => {
    const newDtm = new DataTableManager(mockConfig)
    const csvData = 'id,name,mode\n1,Alice,car\n2,Bob,bike'
    const blob = new Blob([csvData], { type: 'text/csv' })

    const mockFileService = {
      fetchFileAsBlob: vi.fn().mockResolvedValue(blob),
    }

    await newDtm.loadData(mockFileService, '/data')

    expect(mockFileService.fetchFileAsBlob).toHaveBeenCalledWith('/data/test.csv')
    expect(newDtm.getData()).toHaveLength(2)
    expect(newDtm.getData()[0]).toEqual({ id: 1, name: 'Alice', mode: 'car' })
  })

  test('rejects on file service error', async () => {
    const newDtm = new DataTableManager(mockConfig)
    const mockFileService = {
      fetchFileAsBlob: vi.fn().mockRejectedValue(new Error('File not found')),
    }

    await expect(newDtm.loadData(mockFileService, '/data')).rejects.toThrow('File not found')
  })
})
