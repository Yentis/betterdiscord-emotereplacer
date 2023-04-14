export class Logger {
  private static pluginName: string

  public static setLogger (pluginName: string) {
    this.pluginName = pluginName
  }

  public static debug (...args: unknown[]) {
    console.debug(this.pluginName, ...args)
  }

  public static info (...args: unknown[]) {
    console.info(this.pluginName, ...args)
  }

  public static warn (...args: unknown[]) {
    console.warn(this.pluginName, ...args)
  }

  public static error (...args: unknown[]) {
    console.error(this.pluginName, ...args)
  }
}
