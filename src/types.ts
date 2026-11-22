export type ElementType = 'frame' | 'group' | 'text' | 'button' | 'input' | 'image' | 'card' | 'shape' | 'icon'
export type ShapeKind = 'circle' | 'rectangle' | 'line'
export type AutoLayoutDirection = 'none' | 'vertical' | 'horizontal'
export type AutoLayoutAlignment = 'start' | 'center' | 'end' | 'stretch'

export interface CanvasElement {
  id: string
  type: ElementType
  name: string
  parentId?: string
  shapeKind?: ShapeKind
  iconName?: string
  iconStrokeWidth?: number
  linkToPage?: string
  linkToElementId?: string
  flowStartingPoint?: boolean
  autoLayout?: AutoLayoutDirection
  layoutAlign?: AutoLayoutAlignment
  layoutGap?: number
  layoutPadding?: number
  layoutBaseWidth?: number
  layoutBaseHeight?: number
  src?: string
  mimeType?: string
  fontSource?: string
  fontFamily?: string
  fontWeight?: number
  fontStyle?: 'normal' | 'italic'
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  lineHeight?: number
  letterSpacing?: number
  wordSpacing?: number
  textDecoration?: 'none' | 'underline' | 'line-through'
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  rotation?: number
  imageFit?: 'contain' | 'cover' | 'fill'
  objectPositionX?: number
  objectPositionY?: number
  shadow?: number
  shadowAngle?: number
  shadowDistance?: number
  shadowColor?: string
  shadowInset?: boolean
  padding?: number
  x: number
  y: number
  width: number
  height: number
  text: string
  background: string
  color: string
  radius: number
  opacity: number
  fontSize: number
  locked: boolean
  hidden: boolean
}
