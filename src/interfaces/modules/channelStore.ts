import Channel from 'interfaces/channel'

export default interface ChannelStore {
  getChannel: (id: string) => Channel | undefined
}
