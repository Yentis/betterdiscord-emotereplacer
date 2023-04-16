import { WorkerMessage, WorkerMessageType } from './interfaces/workerData'
import init, { applyCommands, initPanicHook } from '../rust/pkg/gif_wasm'
import gifWasm from '../rust/pkg/gif_wasm_bg.wasm'
import { Command } from './interfaces/gifData'

onmessage = (message) => {
  const request = message.data as WorkerMessage
  let response: WorkerMessage
  let promise: Promise<unknown>

  switch (request.type) {
    case WorkerMessageType.INIT:
      promise = initWasm()
      break
    case WorkerMessageType.APPLY_COMMANDS:
      promise = doApplyCommands(request)
      break
    default:
      promise = Promise.reject(new Error('Unknown request type'))
      break
  }

  promise.then((data) => {
    response = {
      type: request.type,
      data
    }

    postMessage(response)
  }).catch((error) => {
    response = {
      type: request.type,
      data: error
    }

    postMessage(response)
  })
}

async function initWasm (): Promise<void> {
  const instance = await gifWasm()
  await init(instance)
  initPanicHook()
}

function doApplyCommands (message: WorkerMessage): Promise<Uint8Array> {
  const {
    data,
    extension,
    commands
  } = message.data as {
    data: Buffer,
    extension: string,
    commands: Command[]
  }

  commands.forEach((command) => {
    const value = (command.param ?? 0).toString()
    command.param = parseFloat(value)
  })

  const result = applyCommands(data, extension, commands)
  return Promise.resolve(result)
}
