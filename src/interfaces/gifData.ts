export interface Command {
  name: string
  param?: string | number
}

export interface SpecialCommand {
  name: string
  value: number
  buffer: Buffer
  type: string
  size: string
  isResized: boolean
}

export interface GifCommands {
  normal: Command[]
  special: Command[]
  priority: Command[]
}
