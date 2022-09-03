import fs from 'fs'
import * as childProcess from 'child_process'
import path from 'path'

// https://github.com/feross/arch
export default function arch () {
  // The running binary is 64-bit, so the OS is clearly 64-bit.
  if (process.arch === 'x64') return 'x64'

  // On Windows, the most reliable way to detect a 64-bit OS from within a 32-bit
  // app is based on the presence of a WOW64 file: %SystemRoot%\SysNative.
  // See: https://twitter.com/feross/status/776949077208510464
  if (process.platform === 'win32') {
    const SystemRoot = process.env.SystemRoot ?? ''
    let useEnv = false

    try {
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      useEnv = !!(SystemRoot && fs.statSync(SystemRoot))
    } catch (err) {}

    const sysRoot = useEnv ? SystemRoot : 'C:\\Windows'

    // If %SystemRoot%\SysNative exists, we are in a WOW64 FS Redirected application.
    let isWOW64 = false
    try {
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      isWOW64 = !!fs.statSync(path.join(sysRoot, 'sysnative'))
    } catch (err) {}

    return isWOW64 ? 'x64' : 'x86'
  }

  // On Linux, use the `getconf` command to get the architecture.
  if (process.platform === 'linux') {
    const output = childProcess.execSync('getconf LONG_BIT', { encoding: 'utf8' })
    return output === '64\n' ? 'x64' : 'x86'
  }

  // If none of the above, assume the architecture is 32-bit.
  return 'x86'
}
