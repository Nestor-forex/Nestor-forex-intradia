// Traduce el código de error de Firebase a una frase que se entienda.
//
// Recibe la función `t` en vez de importarla: quien llama ya está dentro de
// React y sabe el idioma actual, y así este archivo sigue sin depender de la
// interfaz.

const CONOCIDOS = new Set([
  'auth/email-already-in-use',
  'auth/invalid-email',
  'auth/weak-password',
  'auth/missing-password',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/too-many-requests',
  'auth/network-request-failed',
])

export function mensajeError(error, t) {
  const codigo = error?.code
  return CONOCIDOS.has(codigo) ? t(`errores.${codigo}`) : t('errores.generico')
}
