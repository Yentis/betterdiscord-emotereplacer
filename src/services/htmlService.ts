import { BaseService } from './baseService'
import { ModulesService } from './modulesService'

export class HtmlService extends BaseService {
  modulesService!: ModulesService

  public start (modulesService: ModulesService): Promise<void> {
    this.modulesService = modulesService
    return Promise.resolve()
  }

  public addClasses (element: Element, ...classes: string[]): void {
    for (const curClass of classes) {
      if (!curClass) continue
      const split = curClass.split(' ')

      for (const curClassItem of split) {
        element.classList.add(curClassItem)
      }
    }
  }

  public getClassSelector (classes: string): string {
    return classes.split(' ')
      .map((curClass) => !curClass.startsWith('.') ? `.${curClass}` : curClass)
      .join(' ')
  }

  public getTextAreaField (editor: Element | undefined): Element | undefined {
    const textArea = this.modulesService.classes.TextArea.textArea
    return editor?.closest(this.getClassSelector(textArea)) ?? undefined
  }

  public getTextAreaContainer (editor: Element | undefined): Element | undefined {
    const channelTextArea = this.modulesService.classes.TextArea.channelTextArea
    return editor?.closest(this.getClassSelector(channelTextArea)) ?? undefined
  }

  public getEditors (): NodeListOf<Element> {
    const editor = this.modulesService.classes.Editor.editor
    return document.querySelectorAll(this.getClassSelector(editor)) ?? []
  }

  public stop (): void {
    // Do nothing
  }
}
