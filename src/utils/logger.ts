export function setLogger (pluginName: string) {
  Logger = new LoggerClass(pluginName)
}

class LoggerClass {
  private pluginName: string

  constructor (pluginName: string) {
    this.pluginName = pluginName
  }

  public debug (...args: unknown[]) {
    console.debug(this.pluginName, ...args)
  }

  public info (...args: unknown[]) {
    console.info(this.pluginName, ...args)
  }

  public warn (...args: unknown[]) {
    console.warn(this.pluginName, ...args)
  }

  public error (...args: unknown[]) {
    console.error(this.pluginName, ...args)
  }
}

export let Logger: LoggerClass
