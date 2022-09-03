import Channel from 'interfaces/channel'

export default interface Permissions {
  can: (permissions: bigint, channel: Channel, userId: string) => boolean
}
