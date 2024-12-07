import { Listener } from '../interfaces/listener'
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../pluginConstants'
import { BaseService } from './baseService'
import { EmoteService } from './emoteService'
import { ListenersService } from './listenersService'
import { Logger } from '../utils/logger'
import { Utils } from '../utils/utils'
import { BdApiExtended } from '../interfaces/bdapi'
import { Setting, Settings } from '../interfaces/settings'

export class SettingsService extends BaseService {
  private static readonly DELETE_BUTTON_CLICK_LISTENER = 'deleteButtonClick'

  listenersService!: ListenersService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settingListeners: Record<string, (value: any) => void> = {}

  settings: Settings = DEFAULT_SETTINGS

  public start (listenersService: ListenersService): Promise<void> {
    this.listenersService = listenersService

    const savedSettings = BdApi.Data.load(this.plugin.meta.name, SETTINGS_KEY) as Settings
    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings)

    return Promise.resolve()
  }

  public getSettingsElement () {
    const emoteService = this.plugin.emoteService
    if (!emoteService) return undefined

    const UI = (BdApi as BdApiExtended).UI
    const React = BdApi.React
    const ReactDOM = (BdApi as BdApiExtended).ReactDOM
    const settings: Setting[] = []

    this.pushRegularSettings(settings, emoteService)

    const emoteFolderPicker = document.createElement('input')
    emoteFolderPicker.type = 'file'
    emoteFolderPicker.multiple = true
    emoteFolderPicker.accept = '.png,.gif'
    const EmoteFolderPicker = BdApi.ReactUtils.wrapElement(emoteFolderPicker)

    const emoteFolderPickerItem = Utils.SettingItem({
      id: 'emoteFolderPicker',
      inline: false,
      children: [React.createElement(EmoteFolderPicker)]
    })

    const emoteName = document.createElement('input')
    emoteName.type = 'text'
    emoteName.className = 'bd-text-input'
    const EmoteName = BdApi.ReactUtils.wrapElement(emoteName)

    const emoteNameItem = Utils.SettingItem({
      id: 'emoteName',
      name: 'Emote name',
      children: [React.createElement(EmoteName)]
    })

    const imageUrl = document.createElement('input')
    imageUrl.type = 'text'
    imageUrl.className = 'bd-text-input'
    const ImageUrl = BdApi.ReactUtils.wrapElement(imageUrl)

    const imageUrlItem = Utils.SettingItem({
      id: 'imageUrl',
      name: 'Image URL',
      note: 'must end with .gif or .png, 128px recommended',
      children: [React.createElement(ImageUrl)]
    })

    const addButton = React.createElement('button', {
      type: 'button',
      className: 'bd-button bd-button-filled bd-button-color-brand bd-button-medium',
      onClick: () => {
        const files = Array.from(emoteFolderPicker.files ?? []).map((file) => {
          return {
            name: file.name.substring(0, file.name.lastIndexOf('.')),
            // TODO: file.path doesn't work anymore
            url: ''
          }
        })

        if (files.length <= 0) {
          files.push({ name: emoteName.value, url: imageUrl.value })
        }

        const settingsContainers = document.querySelectorAll('.bd-settings-container')
        const emoteContainer = settingsContainers[settingsContainers.length - 1]

        const addPromises = files.map((file) => {
          return this.addEmote(file.name, file.url)
        }).map(async (promise) => {
          if (!(emoteContainer instanceof HTMLElement)) return

          const emoteName = await promise
          const setting = this.createCustomEmoteContainer(emoteName, emoteService)

          const newEmote = document.createElement('div')
          emoteContainer.append(newEmote)

          const root = ReactDOM.createRoot(newEmote)
          root.render(UI.buildSetting(setting))
        })

        Promise.allSettled(addPromises).then((results) => {
          const errors: Error[] = []
          results.forEach((result) => {
            if (result.status === 'fulfilled') return

            errors.push(result.reason as Error)
            Logger.error(result.reason)
          })

          const firstError = errors[0]
          if (firstError) {
            UI.showToast(
              `${firstError.message}${errors.length > 1 ? '\nSee console for all errors' : ''}`,
              { type: 'error' }
            )

            if (addPromises.length === 1) return
          }

          emoteFolderPicker.value = ''
          emoteName.value = ''
          imageUrl.value = ''

          BdApi.Data.save(this.plugin.meta.name, SETTINGS_KEY, this.settings)
          UI.showToast(
            'Emote(s) have been saved',
            { type: 'success' }
          )
        }).catch((error: Error) => {
          UI.showToast(error.message, { type: 'error' })
        })
      }
    }, 'Add')

    const addSettingItem = Utils.SettingItem({
      id: 'addButton',
      inline: false,
      children: [addButton]
    })

    const customEmoteSettings: Setting[] = []

    Object.keys(this.settings.customEmotes).forEach((key) => {
      customEmoteSettings.push(this.createCustomEmoteContainer(key, emoteService))
    })

    const customEmoteGroup = Utils.SettingCategory({
      id: 'customEmoteGroup',
      name: 'Custom emotes',
      collapsible: true,
      shown: false,
      settings: [
        emoteFolderPickerItem,
        emoteNameItem,
        imageUrlItem,
        addSettingItem,
        ...customEmoteSettings
      ]
    })
    settings.push(customEmoteGroup)

    const refreshButton = React.createElement('button', {
      type: 'button',
      className: 'bd-button bd-button-filled bd-button-color-brand bd-button-medium bd-button-grow',
      onClick: () => { emoteService.refreshEmotes() }
    }, 'Refresh emote list')

    const refreshSettingField = Utils.SettingItem({
      id: 'refreshSettingField',
      inline: false,
      children: [refreshButton]
    })
    settings.push(refreshSettingField)

    return UI.buildSettingsPanel({
      settings,
      onChange: (_, settingId, value) => {
        this.settingListeners[settingId]?.(value)
        BdApi.Data.save(this.plugin.meta.name, SETTINGS_KEY, this.settings)
      }
    })
  }

  private async addEmote (emoteName: string, imageUrl: string): Promise<string> {
    if (!emoteName) throw new Error('No emote name entered!')
    if (!imageUrl) throw new Error('No image URL entered!')

    if (!imageUrl.endsWith('.gif') && !imageUrl.endsWith('.png')) {
      throw new Error('Image URL must end with .gif or .png!')
    }

    const emoteService = this.plugin.emoteService
    if (!emoteService) throw new Error('Emote service not found')

    const emoteNames = emoteService.emoteNames ?? {}
    const targetEmoteName = emoteNames[emoteService.getPrefixedName(emoteName)] ?? ''
    if (targetEmoteName) throw new Error('Emote name already exists!')

    this.settings.customEmotes[emoteName] = imageUrl
    emoteNames[emoteService.getPrefixedName(emoteName)] = imageUrl

    emoteService.emoteNames = emoteNames
    return await Promise.resolve(emoteName)
  }

  private pushRegularSettings (
    settings: Setting[],
    emoteService: EmoteService
  ): void {
    const emoteSize = Utils.SliderSetting({
      id: 'emoteSize',
      name: 'Emote Size',
      note: 'The size of emotes. (default 48)',
      min: 32,
      max: 128,
      value: this.settings.emoteSize
      // { units: 'px', markers: [32, 48, 64, 96, 128] }
    })
    settings.push(emoteSize)

    this.settingListeners[emoteSize.id] = (val: number) => {
      this.settings.emoteSize = Math.round(val)
    }

    const autocompleteEmoteSize = Utils.SliderSetting({
      id: 'autocompleteEmoteSize',
      name: 'Autocomplete Emote Size',
      note: 'The size of emotes in the autocomplete window. (default 15)',
      min: 15,
      max: 64,
      value: this.settings.autocompleteEmoteSize
      // { units: 'px', markers: [15, 32, 48, 64] }
    })
    settings.push(autocompleteEmoteSize)

    this.settingListeners[autocompleteEmoteSize.id] = (val: number) => {
      this.settings.autocompleteEmoteSize = Math.round(val)
    }

    const autocompleteItems = Utils.SliderSetting({
      id: 'autocompleteItems',
      name: 'Autocomplete Items',
      note: 'The amount of emotes shown in the autocomplete window. (default 10)',
      min: 1,
      max: 25,
      value: this.settings.autocompleteItems
      // { units: ' items', markers: [1, 5, 10, 15, 20, 25] }
    })
    settings.push(autocompleteItems)

    this.settingListeners[autocompleteItems.id] = (val: number) => {
      this.settings.autocompleteItems = Math.round(val)
    }

    const requirePrefix = Utils.SwitchSetting({
      id: 'requirePrefix',
      name: 'Require prefix',
      note: 'If this is enabled, ' +
      'the autocomplete list will not be shown unless the prefix is also typed.',
      value: this.settings.requirePrefix
    })
    settings.push(requirePrefix)

    this.settingListeners[requirePrefix.id] = (checked: boolean) => {
      this.settings.requirePrefix = checked
    }

    const showStandardEmotes = Utils.SwitchSetting({
      id: 'showStandardEmotes',
      name: 'Show standard custom emotes',
      note: 'If this is enabled, the standard custom emotes will be visible.',
      value: this.settings.showStandardEmotes
    })
    settings.push(showStandardEmotes)

    this.settingListeners[showStandardEmotes.id] = (checked: boolean) => {
      this.settings.showStandardEmotes = checked
      emoteService.refreshEmotes()
    }

    const prefix = Utils.TextSetting({
      id: 'prefix',
      name: 'Prefix',
      note: 'The prefix to check against for the above setting. ' +
      'It is recommended to use a single character not in use by other chat functionality, ' +
      'other prefixes may cause issues.',
      value: this.settings.prefix
    })
    settings.push(prefix)

    this.settingListeners[prefix.id] = (val: string) => {
      if (val === this.settings.prefix) return

      const previousPrefix = this.settings.prefix
      this.settings.prefix = val
      BdApi.Data.save(this.plugin.meta.name, SETTINGS_KEY, this.settings)

      const previousEmoteNames = Object.assign({}, emoteService.emoteNames)
      const emoteNames: Record<string, string> = {}

      Object.entries(previousEmoteNames).forEach(([name, value]) => {
        const prefixedName = emoteService.getPrefixedName(name.replace(previousPrefix, ''))
        emoteNames[prefixedName] = value
      })

      emoteService.emoteNames = emoteNames
    }

    const resizeMethod = Utils.RadioSetting({
      id: 'resizeMethod',
      name: 'Resize Method',
      note: 'How emotes will be scaled down to fit your selected emote size',
      value: this.settings.resizeMethod,
      options: [{
        name: 'Scale down smallest side',
        value: 'smallest'
      }, {
        name: 'Scale down largest side',
        value: 'largest'
      }]
    })
    settings.push(resizeMethod)

    this.settingListeners[resizeMethod.id] = (val: string) => {
      this.settings.resizeMethod = val
    }
  }

  private createCustomEmoteContainer (
    emoteName: string,
    emoteService: EmoteService,
  ): Setting {
    const customEmoteContainer = document.createElement('div')
    customEmoteContainer.style.display = 'flex'

    const url = this.settings.customEmotes[emoteName] ?? ''
    const containerImage = document.createElement('img')
    containerImage.alt = emoteName
    containerImage.title = emoteName
    containerImage.style.minWidth = `${Math.round(this.settings.autocompleteEmoteSize)}px`
    containerImage.style.minHeight = `${Math.round(this.settings.autocompleteEmoteSize)}px`
    containerImage.style.width = `${Math.round(this.settings.autocompleteEmoteSize)}px`
    containerImage.style.height = `${Math.round(this.settings.autocompleteEmoteSize)}px`
    containerImage.style.marginRight = '0.5rem'

    customEmoteContainer.append(containerImage)
    Utils.loadImagePromise(url, false, containerImage).catch((error) => Logger.error(error))

    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.className = 'bd-button bd-button-filled bd-button-color-red'
    deleteButton.innerHTML = '<svg class="" fill="#FFFFFF" viewBox="0 0 24 24" ' +
      'style="width: 20px; height: 20px;"><path fill="none" d="M0 0h24v24H0V0z"></path>' +
      '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.' +
      '12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.1' +
      '2zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"></path><path fill="none" d="M0 0h24v24H0z"></path></svg>'
    customEmoteContainer.append(deleteButton)

    const deleteListener: Listener = {
      element: deleteButton,
      name: 'click',
      callback: () => {
        delete this.settings.customEmotes[emoteName]
        if (emoteService.emoteNames) {
          delete emoteService.emoteNames[emoteService.getPrefixedName(emoteName)]
        }

        BdApi.Data.save(this.plugin.meta.name, SETTINGS_KEY, this.settings)
        BdApi.UI.showToast(`Emote ${emoteName} has been deleted!`, { type: 'success' })

        customEmoteContainer.closest('.bd-setting-item')?.remove()
      }
    }
    deleteButton.addEventListener(deleteListener.name, deleteListener.callback)
    this.listenersService.addListener(
      `${SettingsService.DELETE_BUTTON_CLICK_LISTENER}${emoteName}`,
      deleteListener
    )

    const targetEmote = this.settings.customEmotes[emoteName]
    const CustomEmoteContainer = BdApi.ReactUtils.wrapElement(customEmoteContainer)

    return Utils.SettingItem({
      id: emoteName,
      name: emoteName,
      note: targetEmote ?? '',
      children: [BdApi.React.createElement(CustomEmoteContainer)]
    })
  }

  public stop (): void {
    this.settingListeners = {}
  }
}
