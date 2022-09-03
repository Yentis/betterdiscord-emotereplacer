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

  public getTextAreaField (): Element | undefined {
    const textArea = this.modulesService.classes.TextArea.textArea
    return document.querySelector(this.getClassSelector(textArea)) ?? undefined
  }

  public getTextAreaContainer (): Element | undefined {
    const channelTextArea = this.modulesService.classes.TextArea.channelTextArea
    return document.querySelector(this.getClassSelector(channelTextArea)) ?? undefined
  }

  public stop (): void {
    // Do nothing
  }
}
