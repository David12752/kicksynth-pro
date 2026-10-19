import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { Socket, createConnection } from 'node:net'
import { join } from 'node:path'

type SynthParams = Record<string, number | boolean>
type SampleLayerState = {
  filename: string
  path?: string
  volume: number
  pitchSemitones: number
  startOffset: number
  lowCut: number
  highCut: number
  enabled: boolean
  reverse: boolean
}
type SynthPayload = { params: SynthParams; sampleLayers: SampleLayerState[] }
type PreviewResponse = { waveform: number[]; subWaveform?: number[]; sampleWaveforms?: number[][]; peak?: number; duration?: number; sampleRate?: number; server?: 'juce' | 'fallback' }
type ExportResponse = { success: boolean; path?: string; error?: string }
type TriggerResponse = { success: boolean; error?: string; engine?: 'juce' | 'webaudio' }
type SampleLoadResponse = { success: boolean; slot: number; path?: string; filename?: string; error?: string }
type ServerStateResponse = { success: boolean; connected: boolean; params?: SynthParams; sampleLayers?: SampleLayerState[] }
type WsResponse = Record<string, unknown> & { success?: boolean; error?: string; state?: { params?: SynthParams; sampleLayers?: SampleLayerState[] } }

const SERVER_PORT = 9877
const ZERO_WAVE = Object.freeze(Array.from({ length: 512 }, () => 0))

let serverProcess: ChildProcessWithoutNullStreams | null = null
let serverBootAttempted = false

function getServerPath(): string | null {
  const candidates = [
    join(process.resourcesPath, 'KickSynthServer.exe'),
    join(app.getAppPath(), 'resources', 'KickSynthServer.exe'),
    join(app.getAppPath(), '../resources/KickSynthServer.exe'),
    join(__dirname, '../../resources/KickSynthServer.exe'),
    'C:/KickSynth_build/build/KickSynthPro_artefacts/Release/Server/KickSynthServer.exe'
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 720,
    minWidth: 1200,
    minHeight: 720,
    useContentSize: true,
    resizable: true,
    maximizable: true,
    fullscreenable: false,
    center: true,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    backgroundColor: '#0b0d11',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => {
    win.show()
    win.webContents.send('MAXIMIZE_STATE', win.isMaximized())
  })

  win.on('maximize', () => win.webContents.send('MAXIMIZE_STATE', true))
  win.on('unmaximize', () => win.webContents.send('MAXIMIZE_STATE', false))

  const rendererUrl = process.env.ELECTRON_RENDERER_URL
  if (rendererUrl) {
    void win.loadURL(rendererUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

async function ensureServerStarted(): Promise<void> {
  if (serverBootAttempted)
    return

  serverBootAttempted = true
  const serverPath = getServerPath()
  if (!serverPath)
    return

  try {
    serverProcess = spawn(serverPath, [String(SERVER_PORT)], {
      windowsHide: true,
      stdio: 'ignore'
    })

    serverProcess.once('exit', () => {
      serverProcess = null
    })

    await new Promise((resolve) => setTimeout(resolve, 650))
  } catch {
    serverProcess = null
  }
}

function encodeClientFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8')
  const mask = randomBytes(4)
  const header: number[] = [0x81]

  if (payload.length <= 125) {
    header.push(0x80 | payload.length)
  } else if (payload.length <= 0xffff) {
    header.push(0x80 | 126, (payload.length >> 8) & 0xff, payload.length & 0xff)
  } else {
    throw new Error('Payload too large for KickSynth IPC frame')
  }

  const masked = Buffer.alloc(payload.length)
  for (let index = 0; index < payload.length; index += 1)
    masked[index] = payload[index] ^ mask[index % 4]

  return Buffer.concat([Buffer.from(header), mask, masked])
}

function tryDecodeServerFrame(buffer: Buffer): { text: string; bytesUsed: number } | null {
  if (buffer.length < 2)
    return null

  const second = buffer[1]
  let offset = 2
  let payloadLength = second & 0x7f

  if ((second & 0x80) !== 0)
    throw new Error('Server sent masked websocket frame')

  if (payloadLength === 126) {
    if (buffer.length < 4)
      return null
    payloadLength = buffer.readUInt16BE(2)
    offset = 4
  } else if (payloadLength === 127) {
    throw new Error('Large websocket frames are not supported')
  }

  const frameEnd = offset + payloadLength
  if (buffer.length < frameEnd)
    return null

  return {
    text: buffer.subarray(offset, frameEnd).toString('utf8'),
    bytesUsed: frameEnd
  }
}

async function sendServerCommand<T extends WsResponse>(command: string, payload: Record<string, unknown> = {}, timeoutMs = 2200): Promise<T> {
  await ensureServerStarted()

  return await new Promise<T>((resolve, reject) => {
    const id = `${command}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const socket: Socket = createConnection({ host: '127.0.0.1', port: SERVER_PORT })
    let settled = false
    let handshakeComplete = false
    let requestSent = false
    let raw = Buffer.alloc(0)

    const finish = (fn: () => void) => {
      if (settled)
        return
      settled = true
      clearTimeout(timer)
      socket.removeAllListeners()
      socket.destroy()
      fn()
    }

    const sendRequest = () => {
      if (requestSent)
        return
      requestSent = true
      socket.write(encodeClientFrame(JSON.stringify({ id, cmd: command, ...payload })))
    }

    const handleFrameText = (text: string) => {
      try {
        const data = JSON.parse(text) as WsResponse & { id?: string; type?: string }
        if (data.type === 'ready') {
          sendRequest()
          return
        }
        if (data.id && data.id !== id)
          return
        if (data.success === false) {
          finish(() => reject(new Error(data.error ?? 'JUCE server error')))
          return
        }
        finish(() => resolve(data as T))
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error('Invalid server response')))
      }
    }

    const timer = setTimeout(() => {
      finish(() => reject(new Error('JUCE server timeout')))
    }, timeoutMs)

    socket.on('connect', () => {
      const key = randomBytes(16).toString('base64')
      const handshake = [
        'GET / HTTP/1.1',
        `Host: 127.0.0.1:${SERVER_PORT}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '',
        ''
      ].join('\r\n')
      socket.write(handshake)
    })

    socket.on('data', (chunk: Buffer) => {
      raw = Buffer.concat([raw, chunk])

      if (!handshakeComplete) {
        const headerEnd = raw.indexOf('\r\n\r\n')
        if (headerEnd === -1)
          return
        const headerText = raw.subarray(0, headerEnd).toString('utf8')
        if (!headerText.includes('101 Switching Protocols')) {
          finish(() => reject(new Error('Invalid JUCE websocket handshake')))
          return
        }
        raw = raw.subarray(headerEnd + 4)
        handshakeComplete = true
      }

      while (raw.length > 0) {
        const decoded = tryDecodeServerFrame(raw)
        if (!decoded)
          return
        raw = raw.subarray(decoded.bytesUsed)
        handleFrameText(decoded.text)
      }
    })

    socket.on('error', () => {
      finish(() => reject(new Error('JUCE server unavailable')))
    })
  })
}

function sanitizeLayer(layer: SampleLayerState): SampleLayerState {
  return {
    filename: layer.filename ?? '',
    path: layer.path,
    volume: Number.isFinite(layer.volume) ? layer.volume : 1,
    pitchSemitones: Number.isFinite(layer.pitchSemitones) ? layer.pitchSemitones : 0,
    startOffset: Number.isFinite(layer.startOffset) ? layer.startOffset : 0,
    lowCut: Number.isFinite(layer.lowCut) ? layer.lowCut : 20,
    highCut: Number.isFinite(layer.highCut) ? layer.highCut : 20000,
    enabled: Boolean(layer.enabled),
    reverse: Boolean(layer.reverse)
  }
}

function sanitizePayload(payload: SynthPayload): SynthPayload {
  return {
    params: payload.params ?? {},
    sampleLayers: (payload.sampleLayers ?? []).map(sanitizeLayer)
  }
}

function fallbackPreview(): PreviewResponse {
  return {
    waveform: [...ZERO_WAVE],
    subWaveform: [...ZERO_WAVE],
    sampleWaveforms: [[], [], []],
    peak: 0,
    server: 'fallback'
  }
}

app.whenReady().then(() => {
  createWindow()
  void ensureServerStarted()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin')
    app.quit()
})

app.on('before-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    try {
      serverProcess.kill()
    } catch {
      // noop
    }
  }
})

ipcMain.handle('KICK_PREVIEW', async (_event, rawPayload: SynthPayload): Promise<PreviewResponse> => {
  const payload = sanitizePayload(rawPayload)
  try {
    const response = await sendServerCommand<WsResponse>('preview', payload)
    return {
      waveform: Array.isArray(response.waveform) ? (response.waveform as number[]).slice(0, 512) : [...ZERO_WAVE],
      subWaveform: Array.isArray(response.subWaveform) ? (response.subWaveform as number[]).slice(0, 512) : [...ZERO_WAVE],
      sampleWaveforms: Array.isArray(response.sampleWaveforms) ? (response.sampleWaveforms as number[][]).slice(0, 3) : [[], [], []],
      peak: typeof response.peak === 'number' ? response.peak : 0,
      duration: typeof response.duration === 'number' ? response.duration : undefined,
      sampleRate: typeof response.sampleRate === 'number' ? response.sampleRate : undefined,
      server: 'juce'
    }
  } catch {
    return fallbackPreview()
  }
})

ipcMain.handle('KICK_TRIGGER', async (_event, rawPayload: SynthPayload): Promise<TriggerResponse> => {
  const payload = sanitizePayload(rawPayload)
  try {
    await sendServerCommand('trigger', { ...payload, velocity: Number(payload.params.velocity ?? 1) })
    return { success: true, engine: 'juce' }
  } catch (error) {
    return {
      success: false,
      engine: 'webaudio',
      error: error instanceof Error ? error.message : 'JUCE server unavailable'
    }
  }
})

ipcMain.handle('KICK_EXPORT', async (_event, rawPayload: SynthPayload): Promise<ExportResponse> => {
  const payload = sanitizePayload(rawPayload)
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: 'kick.wav',
    filters: [{ name: 'WAV Audio', extensions: ['wav'] }]
  })

  if (!filePath)
    return { success: false }

  try {
    await sendServerCommand('export', { ...payload, path: filePath }, 5000)
    return { success: true, path: filePath }
  } catch (error) {
    return {
      success: false,
      path: filePath,
      error: error instanceof Error ? error.message : 'Export failed'
    }
  }
})

ipcMain.handle('KICK_LOAD_SAMPLE', async (_event, slot: number): Promise<SampleLoadResponse> => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Audio Files', extensions: ['wav', 'aif', 'aiff', 'mp3', 'flac', 'ogg'] }]
  })

  if (canceled || filePaths.length === 0)
    return { success: false, slot }

  const path = filePaths[0]
  try {
    const response = await sendServerCommand<WsResponse>('load_sample', { slot, path })
    return {
      success: true,
      slot,
      path,
      filename: typeof response.filename === 'string' ? response.filename : path.split(/[\\/]/).pop()
    }
  } catch (error) {
    return {
      success: false,
      slot,
      path,
      error: error instanceof Error ? error.message : 'Failed to load sample'
    }
  }
})

ipcMain.handle('KICK_GET_STATE', async (): Promise<ServerStateResponse> => {
  try {
    const response = await sendServerCommand<WsResponse>('get_state')
    return {
      success: true,
      connected: true,
      params: response.state?.params,
      sampleLayers: response.state?.sampleLayers
    }
  } catch {
    return { success: false, connected: false }
  }
})

ipcMain.on('WINDOW_CLOSE', () => {
  app.quit()
})

ipcMain.on('WINDOW_MINIMIZE', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})

ipcMain.on('WINDOW_MAXIMIZE', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win)
    return
  if (win.isMaximized())
    win.unmaximize()
  else
    win.maximize()
})
