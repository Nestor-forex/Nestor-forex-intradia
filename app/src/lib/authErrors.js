const MENSAJES = {
  'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Prueba en "Ingresar".',
  'auth/invalid-email': 'Ese correo no parece válido.',
  'auth/weak-password': 'La clave debe tener al menos 6 caracteres.',
  'auth/missing-password': 'Escribe una clave.',
  'auth/user-not-found': 'Correo o clave incorrectos, o aún no estás inscrito.',
  'auth/wrong-password': 'Correo o clave incorrectos, o aún no estás inscrito.',
  'auth/invalid-credential': 'Correo o clave incorrectos, o aún no estás inscrito.',
  'auth/invalid-login-credentials': 'Correo o clave incorrectos, o aún no estás inscrito.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a intentar.',
  'auth/network-request-failed': 'No hay conexión a internet. Revisa tu señal y vuelve a intentar.',
}

export function mensajeError(error) {
  return MENSAJES[error?.code] || 'Algo salió mal. Inténtalo de nuevo.'
}
