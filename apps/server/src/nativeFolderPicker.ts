import { execFileSync, spawnSync } from "node:child_process";
import { platform } from "node:os";

/**
 * Opens a native folder picker on the **machine running the OK Code server**.
 * Only safe to call when the WebSocket client is on the same host (loopback).
 */
export function pickFolderNative(): string | null {
  const os = platform();
  if (os === "darwin") {
    const result = spawnSync(
      "osascript",
      ["-e", 'POSIX path of (choose folder with prompt "Select project folder")'],
      { encoding: "utf8", timeout: 120_000 },
    );
    if (result.error || result.status !== 0 || !result.stdout) {
      return null;
    }
    const path = result.stdout.trim();
    return path.length > 0 ? path : null;
  }

  if (os === "win32") {
    try {
      const stdout = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='Select project folder'; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){ $d.SelectedPath }",
        ],
        { encoding: "utf8", timeout: 120_000, windowsHide: true, maxBuffer: 4096 },
      );
      const path = stdout.trim();
      return path.length > 0 ? path : null;
    } catch {
      return null;
    }
  }

  if (os === "linux") {
    const zenity = spawnSync(
      "zenity",
      ["--file-selection", "--directory", "--title=Select project folder"],
      {
        encoding: "utf8",
        timeout: 120_000,
      },
    );
    if (!zenity.error && zenity.status === 0 && zenity.stdout) {
      const path = zenity.stdout.trim();
      if (path.length > 0) return path;
    }

    const kdialog = spawnSync(
      "kdialog",
      ["--getexistingdirectory", ".", "--title", "Select project folder"],
      { encoding: "utf8", timeout: 120_000 },
    );
    if (!kdialog.error && kdialog.status === 0 && kdialog.stdout) {
      const path = kdialog.stdout.trim();
      if (path.length > 0) return path;
    }

    return null;
  }

  return null;
}
