import { Plugin } from 'betterdiscord'
import { ExtendedMeta } from 'interfaces/extendedMeta'
import { Logger, setLogger } from 'utils/logger'

export class RawPlugin implements Plugin {
  private meta: ExtendedMeta

  constructor (meta: ExtendedMeta) {
    this.meta = meta
    setLogger(meta.name)
  }

  start (): void {
    this.showLibraryMissingModal().catch((error) => {
      Logger.error(error)
    })
  }

  private async showLibraryMissingModal () {
    const request = await import('request')
    const electron = await import('electron')
    const fs = await import('fs')
    const path = await import('path')

    BdApi.showConfirmationModal(
      'Library Missing',
      `The library plugin needed for ${this.meta.name} is missing. ` +
      'Please click Download Now to install it.',
      {
        confirmText: 'Download Now',
        cancelText: 'Cancel',
        onConfirm: () => {
          request.get(
            'https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js',
            undefined,
            (error, _response, body: string) => {
              if (error !== undefined && error !== null) {
                electron.shell.openExternal(
                  'https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi' +
                  '/BDPluginLibrary/master/release/0PluginLibrary.plugin.js'
                ).catch((error) => {
                  Logger.error(error)
                })

                return
              }

              fs.writeFile(
                path.join(BdApi.Plugins.folder, '0PluginLibrary.plugin.js'),
                body,
                () => { /* Do nothing */ }
              )
            })
        }
      }
    )
  }

  stop (): void {
    // Do nothing
  }
}
