export default interface UserStore {
  getCurrentUser: () => {
    id: string
  } | undefined
}
