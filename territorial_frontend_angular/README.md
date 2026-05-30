# Valoración Territorial Frontend

Plantilla Angular inicial para consumir el backend Flask de valoración territorial.

## Alcance de esta primera parte

- Angular standalone con routing, SCSS y configuración estricta.
- Proxy `/api` y `/health` hacia `http://127.0.0.1:5000`.
- Capa `core` con cliente HTTP, auth local, guards, interceptores, loading, errores y layout shell.
- Pantallas mínimas de login simulado y dashboard para probar navegación.

## Comandos

```bash
npm install
npm start
```

El backend debe estar corriendo en:

```text
http://127.0.0.1:5000
```

## Notas

- El login actual es simulado porque el backend aún no expone OAuth/token.
- El token se guarda en `localStorage` para preparar guards e interceptor.
- Los módulos funcionales se implementarán por partes sobre esta base.
