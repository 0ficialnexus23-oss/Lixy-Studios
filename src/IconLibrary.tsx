import { useState } from 'react'
import { Search, Star } from 'lucide-react'
import { ICON_CATEGORIES, STUDIO_ICONS } from './iconCatalog'
import './IconLibrary.css'

const FAVORITES_KEY = 'lixy-studios-icon-favorites'
export const ICON_DRAG_MIME = 'application/x-lixy-studio-icon'

function readFavorites() {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
    if (!Array.isArray(stored)) return []
    const knownNames = new Set(STUDIO_ICONS.map(icon => icon.name))
    return stored.filter((name): name is string => typeof name === 'string' && knownNames.has(name))
  } catch {
    return []
  }
}

export default function IconLibrary({ onAddIcon, onNotify }: { onAddIcon: (name: string) => void; onNotify: (message: string) => void }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todas')
  const [favorites, setFavorites] = useState<string[]>(readFavorites)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleIcons = STUDIO_ICONS.filter(icon => {
    const categoryMatches = category === 'Todas'
      || (category === 'Favoritos' ? favorites.includes(icon.name) : icon.category === category)
    const queryMatches = !normalizedQuery || `${icon.name} ${icon.label} ${icon.category}`.toLocaleLowerCase().includes(normalizedQuery)
    return categoryMatches && queryMatches
  })

  function toggleFavorite(name: string) {
    const next = favorites.includes(name) ? favorites.filter(item => item !== name) : [...favorites, name]
    setFavorites(next)
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
    } catch {
      onNotify('No se pudieron guardar los favoritos en este navegador.')
    }
  }

  return (
    <section className="icon-library" aria-label="Biblioteca de iconos">
      <header className="icon-library-heading">
        <div><strong>Biblioteca de iconos</strong><span>SVG · Contorno</span></div>
        <span className="icon-library-count">{visibleIcons.length}</span>
      </header>
      <label className="icon-library-search"><Search /><input aria-label="Buscar iconos" placeholder="Buscar iconos..." value={query} onChange={event => setQuery(event.target.value)} /></label>
      <nav className="icon-library-categories" aria-label="Categorías de iconos">
        {['Todas', 'Favoritos', ...ICON_CATEGORIES].map(item => (
          <button key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>
            {item === 'Favoritos' && <Star aria-hidden="true" />}
            <span>{item}</span>
          </button>
        ))}
      </nav>
      <div className="icon-library-grid" aria-label="Iconos disponibles">
        {visibleIcons.map(entry => {
          const Icon = entry.icon
          const favorite = favorites.includes(entry.name)
          return (
            <div className="icon-library-item" key={entry.name}>
              <button
                className="icon-library-add"
                aria-label={`Añadir icono ${entry.label} al canvas`}
                title={`${entry.label} · clic o arrastrar al canvas`}
                draggable
                onClick={() => onAddIcon(entry.name)}
                onDragStart={event => {
                  event.dataTransfer.setData(ICON_DRAG_MIME, entry.name)
                  event.dataTransfer.effectAllowed = 'copy'
                }}
              ><Icon aria-hidden="true" /></button>
              <button
                className={`icon-library-favorite ${favorite ? 'active' : ''}`}
                aria-label={`${favorite ? 'Quitar' : 'Añadir'} ${entry.label} ${favorite ? 'de' : 'a'} favoritos`}
                aria-pressed={favorite}
                title={favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                onClick={() => toggleFavorite(entry.name)}
              ><Star aria-hidden="true" /></button>
            </div>
          )
        })}
        {visibleIcons.length === 0 && <p className="icon-library-empty">No hay iconos que coincidan. Prueba otra búsqueda o categoría.</p>}
      </div>
      <footer className="icon-library-hint">Haz clic para insertar o arrastra un SVG al canvas.</footer>
    </section>
  )
}
