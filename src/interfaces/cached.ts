import Completion from './completion'

export default interface Cached {
  draft?: string
  candidateText?: string
  completions?: Completion[]
  matchText?: string
  matchStart?: number
  selectedIndex?: number
  windowOffset?: number
}
