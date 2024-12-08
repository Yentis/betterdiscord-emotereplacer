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
  private static readonly EMOTE_PICKER_CHOOSE_CLICK_LISTENER = 'emotePickerChooseClick'
  private static readonly EMOTE_PICKER_CLEAR_CLICK_LISTENER = 'emotePickerClearClick'
  private static readonly DELETE_BUTTON_CLICK_LISTENER = 'deleteButtonClick'
  private static readonly TRASH_ICON = '<svg class="" fill="#FFFFFF" viewBox="0 0 24 24" ' +
      'style="width: 20px; height: 20px;"><path fill="none" d="M0 0h24v24H0V0z"></path>' +
      '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.' +
      '12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.1' +
      '2zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"></path><path fill="none" d="M0 0h24v24H0z"></path></svg>'

  listenersService!: ListenersService

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

    let selectedFiles: string[] = []
    const emotePickerContainer = this.createEmotePickerContainer((filePaths) => {
      selectedFiles = filePaths
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
        const files = Array.from(selectedFiles).map((file) => {
          const split = file.replaceAll('\\', '/').split('/')
          const fileName = split[split.length - 1]
          if (fileName === undefined) return undefined

          return {
            name: fileName.substring(0, fileName.lastIndexOf('.')),
            url: file
          }
        })

        if (files.length <= 0) {
          files.push({ name: emoteName.value, url: imageUrl.value })
        }

        const settingsContainers = document.querySelectorAll('.bd-settings-container')
        const emoteContainer = settingsContainers[settingsContainers.length - 1]

        const addPromises = files.map((file) => {
          return this.addEmote(file?.name, file?.url)
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

          emotePickerContainer.clear()
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
        emotePickerContainer.setting,
        emoteNameItem,
        imageUrlItem,
        addSettingItem,
        ...customEmoteSettings
      ]
    })
    settings.push(customEmoteGroup)

    const refreshButton = React.createElement('button', {
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
      onChange: () => {
        BdApi.Data.save(this.plugin.meta.name, SETTINGS_KEY, this.settings)
      }
    })
  }

  private async addEmote (emoteName?: string, imageUrl?: string): Promise<string> {
    if (emoteName === undefined || emoteName.trim() === '') {
      throw new Error('No emote name entered!')
    }

    if (imageUrl === undefined || imageUrl.trim() === '') {
      throw new Error('No image URL entered!')
    }

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
      units: 'px',
      markers: [32, 48, 64, 96, 128],
      value: this.settings.emoteSize,
      onChange: (val) => {
        this.settings.emoteSize = Math.round(val)
      }
    })
    settings.push(emoteSize)

    const autocompleteEmoteSize = Utils.SliderSetting({
      id: 'autocompleteEmoteSize',
      name: 'Autocomplete Emote Size',
      note: 'The size of emotes in the autocomplete window. (default 15)',
      min: 15,
      max: 64,
      units: 'px',
      markers: [15, 32, 48, 64],
      value: this.settings.autocompleteEmoteSize,
      onChange: (val) => {
        this.settings.autocompleteEmoteSize = Math.round(val)
      }
    })
    settings.push(autocompleteEmoteSize)

    const autocompleteItems = Utils.SliderSetting({
      id: 'autocompleteItems',
      name: 'Autocomplete Items',
      note: 'The amount of emotes shown in the autocomplete window. (default 10)',
      min: 1,
      max: 25,
      value: this.settings.autocompleteItems,
      units: ' items',
      markers: [1, 5, 10, 15, 20, 25],
      onChange: (val) => {
        this.settings.autocompleteItems = Math.round(val)
      }
    })
    settings.push(autocompleteItems)

    const requirePrefix = Utils.SwitchSetting({
      id: 'requirePrefix',
      name: 'Require prefix',
      note: 'If this is enabled, ' +
      'the autocomplete list will not be shown unless the prefix is also typed.',
      value: this.settings.requirePrefix,
      onChange: (checked) => {
        this.settings.requirePrefix = checked
      }
    })
    settings.push(requirePrefix)

    const showStandardEmotes = Utils.SwitchSetting({
      id: 'showStandardEmotes',
      name: 'Show standard custom emotes',
      note: 'If this is enabled, the standard custom emotes will be visible.',
      value: this.settings.showStandardEmotes,
      onChange: (checked) => {
        this.settings.showStandardEmotes = checked
        emoteService.refreshEmotes()
      }
    })
    settings.push(showStandardEmotes)

    const prefix = Utils.TextSetting({
      id: 'prefix',
      name: 'Prefix',
      note: 'The prefix to check against for the above setting. ' +
      'It is recommended to use a single character not in use by other chat functionality, ' +
      'other prefixes may cause issues.',
      value: this.settings.prefix,
      onChange: (val) => {
        if (val === this.settings.prefix) return

        const previousPrefix = this.settings.prefix
        this.settings.prefix = val

        const previousEmoteNames = Object.assign({}, emoteService.emoteNames)
        const emoteNames: Record<string, string> = {}

        Object.entries(previousEmoteNames).forEach(([name, value]) => {
          const prefixedName = emoteService.getPrefixedName(name.replace(previousPrefix, ''))
          emoteNames[prefixedName] = value
        })

        emoteService.emoteNames = emoteNames
      }
    })
    settings.push(prefix)

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
      }],
      onChange: (val) => {
        this.settings.resizeMethod = val
      }
    })
    settings.push(resizeMethod)
  }

  private createEmotePickerContainer (onFiles: (filePaths: string[]) => void): {
    setting: Setting,
    clear: () => void
  } {
    const button = document.createElement('button')
    button.textContent = 'Choose files'
    button.classList.add(
      'bd-button',
      'bd-button-filled',
      'bd-button-color-brand',
      'bd-button-medium',
      'bd-button-grow'
    )

    const clickListener: Listener = {
      element: button,
      name: 'click',
      callback: () => {
        BdApi.UI.openDialog({
          title: 'Choose emotes',
          multiSelections: true,
          filters: [{
            name: 'Emotes',
            extensions: ['png', 'gif']
          }]
        }).then((result) => {
          onFiles(result.filePaths)
          filesList.innerHTML = ''

          if (result.filePaths.length <= 0) {
            clearButton.style.display = 'none'
            return
          }

          clearButton.style.display = 'block'
          result.filePaths.forEach((filePath) => {
            const fileItem = document.createElement('li')
            fileItem.textContent = `- ${filePath}`
            fileItem.style.color = 'var(--header-primary)'
            fileItem.style.textOverflow = 'ellipsis'
            fileItem.style.overflow = 'hidden'
            fileItem.style.textWrap = 'nowrap'

            filesList.append(fileItem)
          })
        }).catch(console.error)
      }
    }

    button.addEventListener(clickListener.name, clickListener.callback)
    this.listenersService.addListener(
      SettingsService.EMOTE_PICKER_CHOOSE_CLICK_LISTENER,
      clickListener,
    )

    const filesList = document.createElement('ul')
    filesList.style.marginTop = '10px'
    filesList.style.display = 'flex'
    filesList.style.flexDirection = 'column'
    filesList.style.gap = '5px'

    const clearButton = document.createElement('button')
    clearButton.className = 'bd-button bd-button-filled bd-button-color-red'
    clearButton.innerHTML = SettingsService.TRASH_ICON
    clearButton.style.display = 'none'

    const onClear = () => {
      onFiles([])
      filesList.innerHTML = ''
      clearButton.style.display = 'none'
    }

    const clearListener: Listener = {
      element: clearButton,
      name: 'click',
      callback: onClear
    }

    clearButton.addEventListener(clearListener.name, clearListener.callback)
    this.listenersService.addListener(
      SettingsService.EMOTE_PICKER_CLEAR_CLICK_LISTENER,
      clearListener,
    )

    const buttonContainer = document.createElement('div')
    buttonContainer.style.display = 'flex'
    buttonContainer.style.gap = '10px'
    buttonContainer.append(button)
    buttonContainer.append(clearButton)

    const emotePickerContainer = document.createElement('div')
    emotePickerContainer.append(buttonContainer)
    emotePickerContainer.append(filesList)
    const EmotePickerContainer = BdApi.ReactUtils.wrapElement(emotePickerContainer)

    return {
      setting: Utils.SettingItem({
        id: 'emotePicker',
        inline: false,
        children: [BdApi.React.createElement(EmotePickerContainer)]
      }),
      clear: onClear
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
    deleteButton.className = 'bd-button bd-button-filled bd-button-color-red'
    deleteButton.innerHTML = SettingsService.TRASH_ICON
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
    // Do nothing
  }
}
