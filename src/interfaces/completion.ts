import Modifier from './modifier'

export default interface Completion {
  name: string
  data: Modifier | string
}
