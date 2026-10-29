export const PDF_PIXEL_LIMIT = 8_000_000
export const PDF_MIN_ZOOM = 0.5
export const PDF_MAX_ZOOM = 3
export function pdfOutputScale(width: number, height: number, ratio: number) {
  return Math.min(Math.max(1, ratio), Math.sqrt(PDF_PIXEL_LIMIT / Math.max(1, width * height)))
}
export function boundedZoom(zoom: number) {
  return Math.min(PDF_MAX_ZOOM, Math.max(PDF_MIN_ZOOM, zoom))
}
