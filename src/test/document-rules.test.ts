import { describe, expect, it } from 'vitest'
import { documentSchema, parseDriveLink } from '@/features/library/document-rules'

const id = '1AbCdEfGhIjKlMnOpQrStUv'
describe('Drive link parsing', () => {
  it.each([`https://drive.google.com/file/d/${id}/view?usp=sharing`, `https://drive.google.com/open?id=${id}`, `https://docs.google.com/document/d/${id}/edit`])('extracts the file id from %s', u => expect(parseDriveLink(u)).toEqual({ ok: true, id }))
  it('rejects folder links', () => expect(parseDriveLink(`https://drive.google.com/drive/folders/${id}`).ok).toBe(false))
  it('rejects other hosts', () => expect(parseDriveLink(`https://evil.example/file/d/${id}/view`).ok).toBe(false))
  it('rejects http', () => expect(parseDriveLink(`http://drive.google.com/file/d/${id}/view`).ok).toBe(false))
})
const base = { title: 'دليل', summary: '', typeId: null, topicIds: ['20000000-0000-4000-8000-000000000001'], tagIds: [], audience: 'everyone' as const, categoryIds: [], groupIds: [], formats: [] }
describe('Document form rules', () => {
  it('requires at least one topic', () => expect(documentSchema.safeParse({ ...base, topicIds: [] }).success).toBe(false))
  it('allows only one link per format', () => expect(documentSchema.safeParse({ ...base, formats: [{ format: 'pdf', driveFileId: id }, { format: 'pdf', driveFileId: id }] }).success).toBe(false))
  it('accepts several different formats', () => expect(documentSchema.safeParse({ ...base, formats: [{ format: 'pdf', driveFileId: id }, { format: 'word', driveFileId: id }] }).success).toBe(true))
  it('requires a category or group for targeted audience', () => expect(documentSchema.safeParse({ ...base, audience: 'targeted' }).success).toBe(false))
})
