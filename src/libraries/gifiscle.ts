import { Stream } from 'stream'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'

export default class Gifsicle extends Stream {
  path = ''

  args: string[] = []

  writable = true

  readable = true

  hasEnded = false

  process?: ChildProcessWithoutNullStreams

  seenDataOnStdout = false

  isPaused = false

  constructor (path: string, args: string[]) {
    super()
    Stream.call(this)

    this.path = path
    this.args = args
  }

  private onError (msg: Error) {
    if (this.hasEnded) return
    this.hasEnded = true
    this.cleanUp()
    this.emit('error', msg)
  }

  private getProcess (): ChildProcessWithoutNullStreams | undefined {
    if (this.process) return this.process
    if (!this.path) {
      this.onError(new Error('Unable to get the gifsicle binary file.'))
      return undefined
    }

    this.seenDataOnStdout = false
    const process = spawn(this.path, this.args)
    this.process = process

    process.on('error', this.onError.bind(this))
    process.stdin.on('error', this.onError.bind(this))

    process.on('exit', (_exitCode) => {
      if (this.hasEnded) return
      const exitCode = _exitCode ?? 0

      if (exitCode > 0 && !this.hasEnded) {
        this.onError(
          new Error(`The gifsicle process exited with a non-zero exit code: ${exitCode}`)
        )
      }

      this.emit('end')
      this.hasEnded = true
    })

    process.stdout
      .on('data', (chunk) => {
        this.seenDataOnStdout = true
        this.emit('data', chunk)
      })
      .on('end', () => {
        this.process = undefined
        if (this.hasEnded) return
        if (this.seenDataOnStdout) {
          this.emit('end')
        } else {
          this.onError(new Error('Gifsicle: STDOUT stream ended without emitting any data.'))
        }
        this.hasEnded = true
      })

    if (this.isPaused) {
      process.stdout.pause()
    }

    return process
  }

  write (newChunk: unknown): boolean {
    if (this.hasEnded) return true
    const process = this.getProcess()
    if (!process) return false

    process.stdin.write(newChunk)
    return true
  }

  cleanUp (): void {
    this.process?.kill()
    this.process = undefined
  }

  destroy (): void {
    if (this.hasEnded) return
    this.hasEnded = true
    this.cleanUp()
  }

  end (chunk: unknown): this {
    if (chunk !== undefined && chunk !== null) this.write(chunk)
    if (this.process) this.process.stdin.end()
    else this.write(Buffer.from(''))

    return this
  }

  pause (): void {
    this.process?.stdout.pause()
    this.isPaused = true
  }

  resume (): void {
    this.process?.stdout.resume()
    this.isPaused = false
  }
}
