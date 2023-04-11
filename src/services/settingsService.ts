import { Listener } from 'interfaces/listener'
import Settings from 'interfaces/settings'
import { SettingGroup, SettingsField } from 'interfaces/zeresPluginLibrary'
import { DEFAULT_SETTINGS, SETTINGS_KEY } from 'pluginConstants'
import { loadImagePromise } from 'utils/promiseUtils'
import { BaseService } from './baseService'
import { EmoteService } from './emoteService'
import { ListenersService } from './listenersService'

export class SettingsService extends BaseService {
  private static readonly ADD_BUTTON_CLICK_LISTENER = 'addButtonClick'
  private static readonly REFRESH_BUTTON_CLICK_LISTENER = 'refreshButtonClick'
  private static readonly DELETE_BUTTON_CLICK_LISTENER = 'deleteButtonClick'

  listenersService!: ListenersService

  settings: Settings = DEFAULT_SETTINGS

  public start (listenersService: ListenersService): Promise<void> {
    this.listenersService = listenersService

    const savedSettings = BdApi.Data.load(this.plugin.meta.name, SETTINGS_KEY) as Settings
    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings)

    return Promise.resolve()
  }

  public getSettingsElement (): HTMLElement {
    const emoteService = this.plugin.emoteService
    if (!emoteService) return new HTMLElement()

    const Settings = this.zeresPluginLibrary.Settings
    const settings: (SettingsField | SettingGroup)[] = []

    this.pushRegularSettings(settings, emoteService)

    const emoteFolderPicker = document.createElement('input')
    emoteFolderPicker.type = 'file'
    emoteFolderPicker.multiple = true
    emoteFolderPicker.accept = '.png,.gif'

    let emoteName: string
    const emoteNameTextbox = new Settings.Textbox(
      undefined,
      'Emote name',
      undefined,
      (val) => { emoteName = val }
    )

    let imageUrl: string
    const imageUrlTextbox = new Settings.Textbox(
      undefined,
      'Image URL (must end with .gif or .png, 128px recommended)',
      undefined,
      (val) => { imageUrl = val }
    )

    const addButton = document.createElement('button')
    addButton.type = 'button'
    addButton.classList.add('bd-button')
    addButton.textContent = 'Add'
    const addSettingField = new Settings.SettingField(undefined, undefined, undefined, addButton)

    const customEmotesContainer = document.createElement('div')
    const addListener: Listener = {
      element: addButton,
      name: 'click',
      callback: () => {
        const files = emoteFolderPicker.files ?? []

        const addPromises = (
          files.length > 0 ? Array.from(files).map((file) => {
            const fileName = file.name.substring(0, file.name.lastIndexOf('.'))
            return this.addEmote(fileName, file.path)
          }) : [this.addEmote(emoteName, imageUrl)]
        ).map(async (promise) => {
          const emoteName = await promise
          customEmotesContainer.append(
            this.createCustomEmoteContainer(emoteName, customEmotesContainer, emoteService)
          )
        })

        Promise.allSettled(addPromises).then((results) => {
          const errors: Error[] = []
          results.forEach((result) => {
            if (result.status === 'fulfilled') return
            errors.push(result.reason as Error)
            console.error(result.reason)
          })

          const firstError = errors[0]
          if (firstError) {
            BdApi.showToast(
              `${firstError.message}${errors.length > 1 ? '\nSee console for all errors' : ''}`,
              { type: 'error' }
            )

            if (addPromises.length === 1) return
          }

          emoteFolderPicker.value = ''
          const emoteNameTextboxInput = emoteNameTextbox.getElement().querySelector('input')
          if (emoteNameTextboxInput) emoteNameTextboxInput.value = ''

          const imageUrlTextboxInput = imageUrlTextbox.getElement().querySelector('input')
          if (imageUrlTextboxInput) imageUrlTextboxInput.value = ''

          BdApi.saveData(this.plugin.meta.name, SETTINGS_KEY, this.settings)
          BdApi.showToast(
            'Emote(s) have been saved',
            { type: 'success' }
          )
        }).catch((error: Error) => {
          BdApi.showToast(error.message, { type: 'error' })
        })
      }
    }
    addButton.addEventListener(addListener.name, addListener.callback)
    this.listenersService.addListener(SettingsService.ADD_BUTTON_CLICK_LISTENER, addListener)

    Object.keys(this.settings.customEmotes).forEach((key) => {
      customEmotesContainer.append(
        this.createCustomEmoteContainer(key, customEmotesContainer, emoteService)
      )
    })

    const customEmoteGroup = new Settings.SettingGroup('Custom emotes')
    customEmoteGroup.append(
      emoteFolderPicker,
      emoteNameTextbox,
      imageUrlTextbox,
      addSettingField,
      customEmotesContainer
    )
    settings.push(customEmoteGroup)

    const refreshButton = document.createElement('button')
    refreshButton.type = 'button'
    refreshButton.classList.add('bd-button')
    refreshButton.textContent = 'Refresh emote list'
    const refreshSettingField = new Settings.SettingField(
      undefined,
      undefined,
      undefined,
      refreshButton
    )

    const refreshListener: Listener = {
      element: refreshButton,
      name: 'click',
      callback: () => { emoteService.refreshEmotes() }
    }
    refreshButton.addEventListener(refreshListener.name, refreshListener.callback)
    this.listenersService.addListener(
      SettingsService.REFRESH_BUTTON_CLICK_LISTENER,
      refreshListener
    )
    settings.push(refreshSettingField)

    return Settings.SettingPanel.build(
      () => { BdApi.saveData(this.plugin.meta.name, SETTINGS_KEY, this.settings) },
      ...settings
    )
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
    settings: (SettingsField | SettingGroup)[],
    emoteService: EmoteService
  ): void {
    const Settings = this.zeresPluginLibrary.Settings

    settings.push(new Settings.Slider(
      'Emote Size',
      'The size of emotes. (default 48)',
      32,
      128,
      this.settings.emoteSize,
      (val) => { this.settings.emoteSize = Math.round(val) },
      { units: 'px', markers: [32, 48, 64, 96, 128] }
    ))

    settings.push(new Settings.Slider(
      'Autocomplete Emote Size',
      'The size of emotes in the autocomplete window. (default 15)',
      15,
      64,
      this.settings.autocompleteEmoteSize,
      (val) => { this.settings.autocompleteEmoteSize = Math.round(val) },
      { units: 'px', markers: [15, 32, 48, 64] }
    ))

    settings.push(new Settings.Slider(
      'Autocomplete Items',
      'The amount of emotes shown in the autocomplete window. (default 10)',
      1,
      25,
      this.settings.autocompleteItems,
      (val) => { this.settings.autocompleteItems = Math.round(val) },
      { units: ' items', markers: [1, 5, 10, 15, 20, 25] }
    ))

    settings.push(new Settings.Switch(
      'Require prefix',
      'If this is enabled, ' +
      'the autocomplete list will not be shown unless the prefix is also typed.',
      this.settings.requirePrefix,
      (checked) => { this.settings.requirePrefix = checked }
    ))

    settings.push(new Settings.Switch(
      'Show standard custom emotes',
      'If this is enabled, the standard custom emotes will be visible.',
      this.settings.showStandardEmotes,
      (checked) => {
        this.settings.showStandardEmotes = checked
        emoteService.refreshEmotes()
      }
    ))

    settings.push(new Settings.Textbox(
      'Prefix',
      'The prefix to check against for the above setting. ' +
      'It is recommended to use a single character not in use by other chat functionality, ' +
      'other prefixes may cause issues.',
      this.settings.prefix,
      _.debounce((val: string) => {
        if (val === this.settings.prefix) return

        const previousPrefix = this.settings.prefix
        this.settings.prefix = val
        BdApi.saveData(this.plugin.meta.name, SETTINGS_KEY, this.settings)

        const previousEmoteNames = Object.assign({}, emoteService.emoteNames)
        const emoteNames: Record<string, string> = {}

        Object.entries(previousEmoteNames).forEach(([name, value]) => {
          const prefixedName = emoteService.getPrefixedName(name.replace(previousPrefix, ''))
          emoteNames[prefixedName] = value
        })

        emoteService.emoteNames = emoteNames
      }, 2000)
    ))

    settings.push(new Settings.RadioGroup(
      'Resize Method',
      'How emotes will be scaled down to fit your selected emote size',
      this.settings.resizeMethod,
      [{
        name: 'Scale down smallest side',
        value: 'smallest'
      }, {
        name: 'Scale down largest side',
        value: 'largest'
      }],
      (val) => { this.settings.resizeMethod = val }
    ))
  }

  private createCustomEmoteContainer (
    emoteName: string,
    container: HTMLDivElement,
    emoteService: EmoteService
  ): Element {
    const Settings = this.zeresPluginLibrary.Settings

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
    loadImagePromise(url, false, containerImage).catch(console.error)

    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.classList.add('bd-button', 'bd-button-danger')
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

        BdApi.saveData(this.plugin.meta.name, SETTINGS_KEY, this.settings)
        BdApi.showToast(`Emote ${emoteName} has been deleted!`, { type: 'success' })

        document.getElementById(emoteName)?.remove()
      }
    }
    deleteButton.addEventListener(deleteListener.name, deleteListener.callback)
    this.listenersService.addListener(
      `${SettingsService.DELETE_BUTTON_CLICK_LISTENER}${emoteName}`,
      deleteListener
    )

    const targetEmote = this.settings.customEmotes[emoteName]
    const existingEmote = new Settings.SettingField(
      emoteName,
      targetEmote,
      undefined,
      customEmoteContainer,
      { noteOnTop: true }
    )

    existingEmote.getElement().id = emoteName
    return existingEmote.getElement()
  }

  public stop (): void {
    // Do nothing
  }
}
