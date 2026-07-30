// Idiomas disponibles. `rtl` marca los que se escriben de derecha a izquierda:
// con esos hay que voltear el diseño entero, no solo cambiar las palabras.
//
// Para agregar un idioma nuevo: crear `textos/<codigo>.js` copiando `es.js`,
// importarlo en `crearT.js` y añadir su entrada aquí. Nada más.
export const IDIOMAS = [
  { codigo: 'es', nombre: 'Español', rtl: false },
  { codigo: 'en', nombre: 'English', rtl: false },
  { codigo: 'de', nombre: 'Deutsch', rtl: false },
  { codigo: 'fr', nombre: 'Français', rtl: false },
  { codigo: 'pt', nombre: 'Português', rtl: false },
  { codigo: 'it', nombre: 'Italiano', rtl: false },
  { codigo: 'zh', nombre: '中文', rtl: false },
  { codigo: 'ja', nombre: '日本語', rtl: false },
  { codigo: 'ru', nombre: 'Русский', rtl: false },
  { codigo: 'ar', nombre: 'العربية', rtl: true },
  { codigo: 'tr', nombre: 'Türkçe', rtl: false },
  { codigo: 'hi', nombre: 'हिन्दी', rtl: false },
  { codigo: 'ko', nombre: '한국어', rtl: false },
]

export const IDIOMA_BASE = 'es'

export const CODIGOS = IDIOMAS.map((i) => i.codigo)

export const esRTL = (codigo) => IDIOMAS.find((i) => i.codigo === codigo)?.rtl === true

// Locale para fechas y números. Se separa del código de idioma porque el
// formato de fecha depende del país, no solo de la lengua: Néstor está en
// Colombia, así que el español usa es-CO y no es-ES.
const LOCALES = {
  es: 'es-CO',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  pt: 'pt-BR',
  it: 'it-IT',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ru: 'ru-RU',
  ar: 'ar-EG',
  tr: 'tr-TR',
  hi: 'hi-IN',
  ko: 'ko-KR',
}

export const localeDe = (codigo) => LOCALES[codigo] || LOCALES[IDIOMA_BASE]
