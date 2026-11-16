// Keeps Windows from going to sleep while a long recording or render runs (the laptop sleeping part way
// through stalls Remotion). It asks Windows to stay awake for as long as this Node process is alive,
// and lets go the moment it ends. It never changes any settings. A closed lid still sleeps, so leave
// the lid open and the laptop plugged in.
import { spawn } from 'node:child_process';

export function keepAwake() {
  if (process.platform !== 'win32') return () => {};
  // A small PowerShell helper calls SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED) and
  // holds it until this process (its parent) exits
  const script = `
Add-Type -Namespace Win -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
[Win.Power]::SetThreadExecutionState([uint32]"0x80000001") | Out-Null
while (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 20 }
[Win.Power]::SetThreadExecutionState([uint32]"0x80000000") | Out-Null`;
  const helper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { stdio: 'ignore', windowsHide: true });
  helper.unref();
  const stop = () => { try { helper.kill(); } catch { /* already gone */ } };
  process.on('exit', stop);
  return stop;
}
