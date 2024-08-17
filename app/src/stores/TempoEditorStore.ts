import { autorun, computed, makeObservable, observable } from "mobx"
import { Layout } from "../Constants"
import { transformEvents } from "../components/TempoGraph/transformEvents"
import { Point } from "../entities/geometry/Point"
import { Rect } from "../entities/geometry/Rect"
import { TempoSelection } from "../entities/selection/TempoSelection"
import { TempoCoordTransform } from "../entities/transform/TempoCoordTransform"
import Quantizer from "../quantizer"
import { PianoRollMouseMode } from "./PianoRollStore"
import RootStore from "./RootStore"
import { RulerStore } from "./RulerStore"

export default class TempoEditorStore {
  readonly rulerStore: RulerStore

  scrollLeft: number = 0
  scaleX: number = 1
  autoScroll: boolean = true
  canvasWidth: number = 0
  canvasHeight: number = 0
  quantize = 4
  isQuantizeEnabled = true
  mouseMode: PianoRollMouseMode = "pencil"
  selection: TempoSelection | null = null
  selectedEventIds: number[] = []

  constructor(readonly rootStore: RootStore) {
    this.rulerStore = new RulerStore(this)

    makeObservable(this, {
      scrollLeft: observable,
      scaleX: observable,
      autoScroll: observable,
      canvasWidth: observable,
      canvasHeight: observable,
      quantize: observable,
      isQuantizeEnabled: observable,
      mouseMode: observable,
      selection: observable,
      selectedEventIds: observable,
      transform: computed,
      items: computed,
      cursorX: computed,
      contentWidth: computed,
      controlPoints: computed,
      selectionRect: computed,
    })
  }

  setUpAutorun() {
    // keep scroll position to cursor
    autorun(() => {
      const { isPlaying, position } = this.rootStore.player
      const { autoScroll, transform, curPlayheadScreenOffset } = this

      if (
        isPlaying &&
        autoScroll &&
        this.playheadInScrollZone(curPlayheadScreenOffset)
      ) {
        this.scrollLeft = transform.getX(position)
      }
    })
  }

  setScrollLeft(x: number) {
    this.scrollLeft = x
  }

  get transform() {
    const pixelsPerTick = Layout.pixelsPerTick * this.scaleX
    return new TempoCoordTransform(pixelsPerTick, this.canvasHeight)
  }

  get cursorX(): number {
    return this.transform.getX(this.rootStore.player.position)
  }

  // Position of the playhead relative to the current screen.
  get curPlayheadScreenOffset(): number {
    return this.playheadScreenOffset(this.scrollLeft)
  }

  // Position of the playhead relative to a screen. `scrollLeft` is the position
  // in the song where the screen starts.
  playheadScreenOffset(scrollLeft: number): number {
    const position = this.rootStore.player.position
    return this.transform.getX(position) - scrollLeft
  }

  // Returns true if the user needs to scroll to comfortably view the playhead.
  playheadInScrollZone(playheadPos: number): boolean {
    return playheadPos < 0 || playheadPos > this.canvasWidth * 0.7
  }

  get items() {
    const { transform, canvasWidth, scrollLeft } = this
    const events = this.rootStore.song.conductorTrack?.events ?? []
    return transformEvents(events, transform, canvasWidth + scrollLeft)
  }

  get contentWidth() {
    const { scrollLeft, transform, canvasWidth } = this
    const trackEndTick = this.rootStore.song.endOfSong
    const startTick = transform.getTick(scrollLeft)
    const widthTick = transform.getTick(canvasWidth)
    const endTick = startTick + widthTick

    return transform.getX(Math.max(trackEndTick, endTick))
  }

  get quantizer(): Quantizer {
    return new Quantizer(this.rootStore, this.quantize, this.isQuantizeEnabled)
  }

  // draggable hit areas for each tempo changes
  get controlPoints() {
    const { items } = this
    const circleRadius = 4
    return items.map((p) => ({
      ...pointToCircleRect(p.bounds, circleRadius),
      id: p.id,
    }))
  }

  get selectionRect() {
    const { selection, transform } = this
    return selection != null
      ? TempoSelection.getBounds(selection, transform)
      : null
  }

  hitTest(point: Point): number | undefined {
    return this.controlPoints.find((r) => Rect.containsPoint(r, point))?.id
  }
}

export const pointToCircleRect = (p: Point, radius: number) => ({
  x: p.x - radius,
  y: p.y - radius,
  width: radius * 2,
  height: radius * 2,
})
