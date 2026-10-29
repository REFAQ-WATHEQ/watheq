import { describe, expect, it } from 'vitest'
import { boundedZoom, pdfOutputScale, PDF_PIXEL_LIMIT } from '@/features/library/pdf-render-rules'
describe('PDF bounded rendering', () => {
  it('caps one rendered canvas at eight million pixels on high-density screens', () => {
    expect(PDF_PIXEL_LIMIT).toBe(8_000_000)
    const scale = pdfOutputScale(3000, 4000, 3)
    expect(3000 * 4000 * scale * scale).toBeLessThanOrEqual(8_000_000)
    expect(pdfOutputScale(600, 800, 2)).toBe(2)
  })
  it('limits zoom to 50 through 300 percent', () => {
    expect(boundedZoom(0.1)).toBe(0.5)
    expect(boundedZoom(9)).toBe(3)
    expect(boundedZoom(1.25)).toBe(1.25)
  })
})
