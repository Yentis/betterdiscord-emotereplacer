import User from 'interfaces/user'

export default interface UserStore {
  getCurrentUser: () => User | undefined
}
