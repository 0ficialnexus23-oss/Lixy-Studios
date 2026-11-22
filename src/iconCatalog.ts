import { createElement } from 'react'
import {
  Accessibility, Activity, ArrowRight, AtSign, Banknote, BookOpen, Bot,
  BrainCircuit, Bug, Camera, CarFront, Code2, CreditCard, Database,
  GraduationCap, Heart, HeartPulse, House, Image, KeyRound, Leaf,
  LockKeyhole, Mail, MapPin, Menu, MessageCircle, Monitor, Music2,
  Package, Phone, Plane, Play, Search, Send, Settings2, Share2,
  ShieldCheck, ShoppingBag, ShoppingCart, Smartphone, Sparkles,
  Stethoscope, Sun, Terminal, TrainFront, TreePine, UserRound, UsersRound,
  Video, Wallet, Wifi, Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface StudioIcon {
  name: string
  label: string
  category: string
  icon: LucideIcon
}

export const ICON_CATEGORIES = [
  'Redes sociales',
  'Tecnología',
  'Comunicación',
  'Comercio',
  'Finanzas',
  'Transporte',
  'Educación',
  'Salud',
  'Seguridad',
  'Multimedia',
  'Inteligencia artificial',
  'Desarrollo',
  'Naturaleza',
  'Personas',
  'Configuración',
  'Navegación',
] as const

export const STUDIO_ICONS: StudioIcon[] = [
  { name: 'Heart', label: 'Me gusta', category: 'Redes sociales', icon: Heart },
  { name: 'MessageCircle', label: 'Conversación', category: 'Redes sociales', icon: MessageCircle },
  { name: 'Share2', label: 'Compartir', category: 'Redes sociales', icon: Share2 },
  { name: 'AtSign', label: 'Mención', category: 'Redes sociales', icon: AtSign },
  { name: 'Camera', label: 'Cámara', category: 'Redes sociales', icon: Camera },
  { name: 'Monitor', label: 'Monitor', category: 'Tecnología', icon: Monitor },
  { name: 'Smartphone', label: 'Teléfono', category: 'Tecnología', icon: Smartphone },
  { name: 'Wifi', label: 'Wi-Fi', category: 'Tecnología', icon: Wifi },
  { name: 'Mail', label: 'Correo', category: 'Comunicación', icon: Mail },
  { name: 'Phone', label: 'Teléfono', category: 'Comunicación', icon: Phone },
  { name: 'Send', label: 'Enviar', category: 'Comunicación', icon: Send },
  { name: 'ShoppingCart', label: 'Carrito', category: 'Comercio', icon: ShoppingCart },
  { name: 'ShoppingBag', label: 'Bolsa', category: 'Comercio', icon: ShoppingBag },
  { name: 'Package', label: 'Paquete', category: 'Comercio', icon: Package },
  { name: 'CreditCard', label: 'Tarjeta', category: 'Finanzas', icon: CreditCard },
  { name: 'Wallet', label: 'Billetera', category: 'Finanzas', icon: Wallet },
  { name: 'Banknote', label: 'Efectivo', category: 'Finanzas', icon: Banknote },
  { name: 'CarFront', label: 'Automóvil', category: 'Transporte', icon: CarFront },
  { name: 'Plane', label: 'Avión', category: 'Transporte', icon: Plane },
  { name: 'TrainFront', label: 'Tren', category: 'Transporte', icon: TrainFront },
  { name: 'BookOpen', label: 'Libro', category: 'Educación', icon: BookOpen },
  { name: 'GraduationCap', label: 'Graduación', category: 'Educación', icon: GraduationCap },
  { name: 'HeartPulse', label: 'Salud', category: 'Salud', icon: HeartPulse },
  { name: 'Stethoscope', label: 'Estetoscopio', category: 'Salud', icon: Stethoscope },
  { name: 'Activity', label: 'Actividad', category: 'Salud', icon: Activity },
  { name: 'ShieldCheck', label: 'Protección', category: 'Seguridad', icon: ShieldCheck },
  { name: 'LockKeyhole', label: 'Candado', category: 'Seguridad', icon: LockKeyhole },
  { name: 'KeyRound', label: 'Llave', category: 'Seguridad', icon: KeyRound },
  { name: 'Image', label: 'Imagen', category: 'Multimedia', icon: Image },
  { name: 'Play', label: 'Reproducir', category: 'Multimedia', icon: Play },
  { name: 'Music2', label: 'Música', category: 'Multimedia', icon: Music2 },
  { name: 'Video', label: 'Video', category: 'Multimedia', icon: Video },
  { name: 'BrainCircuit', label: 'Inteligencia artificial', category: 'Inteligencia artificial', icon: BrainCircuit },
  { name: 'Bot', label: 'Asistente', category: 'Inteligencia artificial', icon: Bot },
  { name: 'Sparkles', label: 'Destellos', category: 'Inteligencia artificial', icon: Sparkles },
  { name: 'Code2', label: 'Código', category: 'Desarrollo', icon: Code2 },
  { name: 'Terminal', label: 'Terminal', category: 'Desarrollo', icon: Terminal },
  { name: 'Database', label: 'Base de datos', category: 'Desarrollo', icon: Database },
  { name: 'Bug', label: 'Error', category: 'Desarrollo', icon: Bug },
  { name: 'Leaf', label: 'Hoja', category: 'Naturaleza', icon: Leaf },
  { name: 'TreePine', label: 'Árbol', category: 'Naturaleza', icon: TreePine },
  { name: 'Sun', label: 'Sol', category: 'Naturaleza', icon: Sun },
  { name: 'UserRound', label: 'Usuario', category: 'Personas', icon: UserRound },
  { name: 'UsersRound', label: 'Personas', category: 'Personas', icon: UsersRound },
  { name: 'Accessibility', label: 'Accesibilidad', category: 'Personas', icon: Accessibility },
  { name: 'Settings2', label: 'Ajustes', category: 'Configuración', icon: Settings2 },
  { name: 'House', label: 'Inicio', category: 'Navegación', icon: House },
  { name: 'Search', label: 'Buscar', category: 'Navegación', icon: Search },
  { name: 'Menu', label: 'Menú', category: 'Navegación', icon: Menu },
  { name: 'MapPin', label: 'Ubicación', category: 'Navegación', icon: MapPin },
  { name: 'ArrowRight', label: 'Siguiente', category: 'Navegación', icon: ArrowRight },
  { name: 'Zap', label: 'Energía', category: 'Tecnología', icon: Zap },
]

const iconsByName = new Map(STUDIO_ICONS.map(entry => [entry.name, entry]))

export function getStudioIcon(name: string | undefined) {
  return name ? iconsByName.get(name) : undefined
}

export async function renderStudioIconSvg(name: string | undefined, color: string, width: number, height: number, strokeWidth = 2) {
  const entry = getStudioIcon(name)
  if (!entry) return ''
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(createElement(entry.icon, {
    width,
    height,
    color,
    strokeWidth: Math.max(1, Math.min(4, strokeWidth)),
    'aria-hidden': true,
  }))
}
