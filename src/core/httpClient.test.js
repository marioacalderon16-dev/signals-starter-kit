// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from './httpClient.js'

const respond = (body, { status = 200, type = 'application/json' } = {}) =>
  new Response(body, { status, headers: type ? { 'Content-Type': type } : {} })

describe('HttpClient', () => {
  let fetchMock
  const api = new HttpClient({ baseUrl: 'https://api.test/' })

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('GET no envía Content-Type (evita preflight CORS)', async () => {
    fetchMock.mockResolvedValue(respond('{"ok":true}'))
    expect(await api.get('/items')).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/items')
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('POST con objeto envía JSON con Content-Type', async () => {
    fetchMock.mockResolvedValue(respond('{}'))
    await api.post('/items', { a: 1 })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBe('{"a":1}')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('data 0 o false no se descarta', async () => {
    fetchMock.mockResolvedValue(respond('{}'))
    await api.put('/flag', false)
    expect(fetchMock.mock.calls[0][1].body).toBe('false')
  })

  it('FormData se envía tal cual, sin Content-Type JSON', async () => {
    fetchMock.mockResolvedValue(respond('{}'))
    const form = new FormData()
    form.append('f', 'v')
    await api.post('/upload', form)
    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBe(form)
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('respuesta de texto y respuesta vacía', async () => {
    fetchMock.mockResolvedValueOnce(respond('hola', { type: 'text/plain' }))
    expect(await api.get('/txt')).toBe('hola')
    fetchMock.mockResolvedValueOnce(respond('', { type: null }))
    expect(await api.get('/vacio')).toBeNull()
    fetchMock.mockResolvedValueOnce(respond(null, { status: 204, type: null }))
    expect(await api.delete('/x')).toBeNull()
  })

  it('error HTTP incluye status y data', async () => {
    fetchMock.mockResolvedValue(respond('{"message":"No encontrado","code":"E404"}', { status: 404 }))
    await expect(api.get('/nada')).rejects.toMatchObject({
      message: 'No encontrado',
      status: 404,
      data: { message: 'No encontrado', code: 'E404' }
    })
  })

  it('timeout aborta la petición', async () => {
    fetchMock.mockImplementation((_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason))
    }))
    await expect(api.get('/lento', {}, { timeout: 10 })).rejects.toThrow()
  })

  it('acepta un AbortSignal externo', async () => {
    fetchMock.mockResolvedValue(respond('{}'))
    const controller = new AbortController()
    await api.get('/x', {}, { signal: controller.signal })
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal)
  })
})
