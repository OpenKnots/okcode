import { afterEach, describe, expect, it, vi } from "vitest";

interface NativeFolderPickerModule {
  pickFolderNative: () => string | null;
}

async function loadNativeFolderPicker(platformName: string) {
  const spawnSyncMock = vi.fn();
  const execFileSyncMock = vi.fn();

  vi.resetModules();
  vi.doMock("node:os", () => ({
    platform: () => platformName,
  }));
  vi.doMock("node:child_process", () => ({
    execFileSync: execFileSyncMock,
    spawnSync: spawnSyncMock,
  }));

  const module = (await import("./nativeFolderPicker")) as NativeFolderPickerModule;

  return {
    execFileSyncMock,
    pickFolderNative: module.pickFolderNative,
    spawnSyncMock,
  };
}

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("pickFolderNative", () => {
  it("returns a trimmed macOS folder path from osascript", async () => {
    const { pickFolderNative, spawnSyncMock } = await loadNativeFolderPicker("darwin");
    spawnSyncMock.mockReturnValue({
      error: undefined,
      status: 0,
      stdout: "/tmp/project/\n",
    });

    expect(pickFolderNative()).toBe("/tmp/project/");
    expect(spawnSyncMock).toHaveBeenCalledWith(
      "osascript",
      ["-e", 'POSIX path of (choose folder with prompt "Select project folder")'],
      { encoding: "utf8", timeout: 120_000 },
    );
  });

  it("returns null when the macOS picker fails", async () => {
    const { pickFolderNative, spawnSyncMock } = await loadNativeFolderPicker("darwin");
    spawnSyncMock.mockReturnValue({
      error: new Error("spawn failed"),
      status: 1,
      stdout: "",
    });

    expect(pickFolderNative()).toBeNull();
  });

  it("returns a trimmed Windows folder path from PowerShell", async () => {
    const { execFileSyncMock, pickFolderNative } = await loadNativeFolderPicker("win32");
    execFileSyncMock.mockReturnValue("C:\\Users\\okcode\\project\r\n");

    expect(pickFolderNative()).toBe("C:\\Users\\okcode\\project");
    expect(execFileSyncMock).toHaveBeenCalledWith(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='Select project folder'; if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){ $d.SelectedPath }",
      ],
      { encoding: "utf8", timeout: 120_000, windowsHide: true, maxBuffer: 4096 },
    );
  });

  it("returns null when the Windows picker throws", async () => {
    const { execFileSyncMock, pickFolderNative } = await loadNativeFolderPicker("win32");
    execFileSyncMock.mockImplementation(() => {
      throw new Error("powershell failed");
    });

    expect(pickFolderNative()).toBeNull();
  });

  it("prefers zenity on Linux when it succeeds", async () => {
    const { pickFolderNative, spawnSyncMock } = await loadNativeFolderPicker("linux");
    spawnSyncMock.mockReturnValueOnce({
      error: undefined,
      status: 0,
      stdout: "/tmp/linux-project\n",
    });

    expect(pickFolderNative()).toBe("/tmp/linux-project");
    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      "zenity",
      ["--file-selection", "--directory", "--title=Select project folder"],
      {
        encoding: "utf8",
        timeout: 120_000,
      },
    );
  });

  it("falls back to kdialog on Linux when zenity fails", async () => {
    const { pickFolderNative, spawnSyncMock } = await loadNativeFolderPicker("linux");
    spawnSyncMock
      .mockReturnValueOnce({
        error: new Error("zenity missing"),
        status: 1,
        stdout: "",
      })
      .mockReturnValueOnce({
        error: undefined,
        status: 0,
        stdout: "/tmp/kdialog-project\n",
      });

    expect(pickFolderNative()).toBe("/tmp/kdialog-project");
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      2,
      "kdialog",
      ["--getexistingdirectory", ".", "--title", "Select project folder"],
      { encoding: "utf8", timeout: 120_000 },
    );
  });

  it("returns null on Linux when both pickers fail", async () => {
    const { pickFolderNative, spawnSyncMock } = await loadNativeFolderPicker("linux");
    spawnSyncMock
      .mockReturnValueOnce({
        error: new Error("zenity missing"),
        status: 1,
        stdout: "",
      })
      .mockReturnValueOnce({
        error: new Error("kdialog missing"),
        status: 1,
        stdout: "",
      });

    expect(pickFolderNative()).toBeNull();
  });

  it("returns null on unsupported platforms without invoking child processes", async () => {
    const { execFileSyncMock, pickFolderNative, spawnSyncMock } =
      await loadNativeFolderPicker("freebsd");

    expect(pickFolderNative()).toBeNull();
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });
});
