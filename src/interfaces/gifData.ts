export interface Command {
  name: string
  param?: string | number
}

export interface SpecialCommand {
  name: string
  value: number
  size: string
}
