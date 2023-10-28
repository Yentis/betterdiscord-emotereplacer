import * as electron from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { Plugin } from 'betterdiscord'
import { ExtendedMeta } from '../interfaces/extendedMeta'
import { Logger } from '../utils/logger'
import { Utils } from '../utils/utils'

export class RawPlugin implements Plugin {
  private meta: ExtendedMeta

  constructor (meta: ExtendedMeta) {
    this.meta = meta
    Logger.setLogger(meta.name)
  }

  start (): void {
    this.showLibraryMissingModal()
  }

  private showLibraryMissingModal () {
    BdApi.UI.showConfirmationModal(
      'Library Missing',
      `The library plugin needed for ${this.meta.name} is missing. ` +
      'Please click Download Now to install it.',
      {
        confirmText: 'Download Now',
        cancelText: 'Cancel',
        onConfirm: () => {
          Utils.urlGetBuffer(
            'https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js'
          ).then((data) => {
            fs.writeFile(
              path.join(BdApi.Plugins.folder, '0PluginLibrary.plugin.js'),
              data,
              () => { /* Do nothing */ }
            )
          }).catch(() => {
            electron.shell.openExternal(
              'https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi' +
              '/BDPluginLibrary/master/release/0PluginLibrary.plugin.js'
            ).catch((error) => {
              Logger.error(error)
            })
          })
        }
      }
    )
  }

  stop (): void {
    // Do nothing
  }
}
