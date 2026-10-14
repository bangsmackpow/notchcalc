declare module 'dxf-writer' {
  export default class Drawing {
    constructor()
    static ACI: Record<string, number>
    setUnits(units: string): this
    addLayer(name: string, color: number, lineType: string): this
    setActiveLayer(name: string): this
    drawPolyline(points: Array<[number, number]>, closed?: boolean): this
    drawLine(x1: number, y1: number, x2: number, y2: number): this
    toDxfString(): string
  }
}
