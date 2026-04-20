import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT_DIR = resolve(process.cwd());
const TARGET_FILE = resolve(
  ROOT_DIR,
  "node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsPlugin.swift",
);

const REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [
    /guard let notifications = call\.getArray\("notifications", JSObject\.self\) else \{/g,
    'guard let notifications = call.getArray("notifications")?.compactMap({ $0 as? JSObject }) else {',
  ],
  [
    /guard let notifications = call\.getArray\("notifications", JSObject\.self\), notifications\.count > 0 else \{/g,
    'guard let notifications = call.getArray("notifications")?.compactMap({ $0 as? JSObject }), notifications.count > 0 else {',
  ],
  [
    /guard let types = call\.getArray\("types", JSObject\.self\) else \{/g,
    'guard let types = call.getArray("types")?.compactMap({ $0 as? JSObject }) else {',
  ],
  [
    /return bridge\?\.localURL\(fromWebURL: webURL\)/g,
    [
      "        switch webURL.scheme {",
      '        case "res":',
      "            return bridge?.config.appLocation.appendingPathComponent(webURL.path)",
      '        case "file":',
      "            return webURL",
      "        default:",
      "            return nil",
      "        }",
    ].join("\n"),
  ],
];

if (!existsSync(TARGET_FILE)) {
  console.log(`Skipping Capacitor local-notifications patch; missing file: ${TARGET_FILE}`);
  process.exit(0);
}

const original = readFileSync(TARGET_FILE, "utf8");
let updated = original;

for (const [pattern, replacement] of REPLACEMENTS) {
  updated = updated.replace(pattern, replacement);
}

if (updated !== original) {
  writeFileSync(TARGET_FILE, updated);
  console.log(`Patched ${TARGET_FILE}`);
} else {
  console.log(`No patch needed for ${TARGET_FILE}`);
}
