import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT_DIR = resolve(process.cwd());
const PACKAGE_FILE = resolve(ROOT_DIR, "node_modules/@capacitor/local-notifications/package.json");
const TARGET_FILE = resolve(
  ROOT_DIR,
  "node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsPlugin.swift",
);
const HANDLER_FILE = resolve(
  ROOT_DIR,
  "node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsHandler.swift",
);

const SWIFT_REPLACEMENTS: ReadonlyArray<[string, string]> = [
  [
    'call.getArray("notifications", JSObject.self)',
    'call.getArray("notifications", []).compactMap({ $0 as? JSObject })',
  ],
  [
    'call.getArray("notifications")?.compactMap({ $0 as? JSObject })',
    'call.getArray("notifications", []).compactMap({ $0 as? JSObject })',
  ],
  ['call.getArray("types", JSObject.self)', 'call.getArray("types", []).compactMap({ $0 as? JSObject })'],
  ['call.getArray("types")?.compactMap({ $0 as? JSObject })', 'call.getArray("types", []).compactMap({ $0 as? JSObject })'],
  ["call.reject(\"Must provide notifications array as notifications option\")", "call.unimplemented(\"Must provide notifications array as notifications option\")"],
  ["call.reject(\"Notification missing identifier\")", "call.unimplemented(\"Notification missing identifier\")"],
  ["call.reject(\"Unable to make notification\", nil, error)", "call.unimplemented(\"Unable to make notification\")"],
  [
    "call.reject(\"Unable to create notification, trigger failed\", nil, error)",
    "call.unimplemented(\"Unable to create notification, trigger failed\")",
  ],
  ["call.reject(theError.localizedDescription)", "call.unimplemented(theError.localizedDescription)"],
  ["call.reject(error!.localizedDescription)", "call.unimplemented(error!.localizedDescription)"],
  ["call.reject(\"Must supply notifications to cancel\")", "call.unimplemented(\"Must supply notifications to cancel\")"],
  [
    "call.reject(\"Scheduled time must be *after* current time\")",
    "call.unimplemented(\"Scheduled time must be *after* current time\")",
  ],
  ["call.reject(\"Must supply notifications to remove\")", "call.unimplemented(\"Must supply notifications to remove\")"],
  [
    "return bridge?.localURL(fromWebURL: webURL)",
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
const LEGACY_PLUGIN_PATTERNS = [
  'call.getArray("notifications", JSObject.self)',
  'call.getArray("notifications")?.compactMap({ $0 as? JSObject })',
  "call.reject(",
] as const;
const REQUIRED_PATCHED_PATTERNS = [
  'call.getArray("notifications", []).compactMap({ $0 as? JSObject })',
  'call.getArray("types", []).compactMap({ $0 as? JSObject })',
] as const;
const FORBIDDEN_PATCHED_PATTERNS = [
  "call.reject(",
  'call.getArray("notifications", JSObject.self)',
  'call.getArray("notifications")?.compactMap({ $0 as? JSObject })',
  'call.getArray("types", JSObject.self)',
  'call.getArray("types")?.compactMap({ $0 as? JSObject })',
] as const;

const HANDLER_PATCH = {
  search:
    `    func makePendingNotificationRequestJSObject(_ request: UNNotificationRequest) -> JSObject {\n` +
    `        var notification: JSObject = [\n` +
    `            "id": Int(request.identifier) ?? -1,\n` +
    `            "title": request.content.title,\n` +
    `            "body": request.content.body\n` +
    `        ]\n` +
    `\n` +
    `        if let userInfo = JSTypes.coerceDictionaryToJSObject(request.content.userInfo) {\n` +
    `            var extra = userInfo["cap_extra"] as? JSObject ?? userInfo\n` +
    `\n` +
    `            // check for any dates and convert them to strings\n` +
    `            for(key, value) in extra {\n` +
    `                if let date = value as? Date {\n` +
    `                    let dateString = ISO8601DateFormatter().string(from: date)\n` +
    `                    extra[key] = dateString\n` +
    `                }\n` +
    `            }\n` +
    `\n` +
    `            notification["extra"] = extra\n` +
    `\n` +
    `            if var schedule = userInfo["cap_schedule"] as? JSObject {\n` +
    `                // convert schedule at date to string\n` +
    `                if let date = schedule["at"] as? Date {\n` +
    `                    let dateString = ISO8601DateFormatter().string(from: date)\n` +
    `                    schedule["at"] = dateString\n` +
    `                }\n` +
    `\n` +
    `                notification["schedule"] = schedule\n` +
    `            }\n` +
    `        }\n` +
    `\n` +
    `        return notification\n` +
    `\n` +
    `    }\n`,
  replace:
    `    func makePendingNotificationRequestJSObject(_ request: UNNotificationRequest) -> JSObject {\n` +
    `        var notification: JSObject = [\n` +
    `            "id": Int(request.identifier) ?? -1,\n` +
    `            "title": request.content.title,\n` +
    `            "body": request.content.body\n` +
    `        ]\n` +
    `\n` +
    `        if let userInfo = makeJSObject(from: request.content.userInfo) {\n` +
    `            var extra = userInfo["cap_extra"] as? JSObject ?? userInfo\n` +
    `\n` +
    `            // check for any dates and convert them to strings\n` +
    `            for(key, value) in extra {\n` +
    `                if let date = value as? Date {\n` +
    `                    let dateString = ISO8601DateFormatter().string(from: date)\n` +
    `                    extra[key] = dateString\n` +
    `                }\n` +
    `            }\n` +
    `\n` +
    `            notification["extra"] = extra\n` +
    `\n` +
    `            if var schedule = userInfo["cap_schedule"] as? JSObject {\n` +
    `                // convert schedule at date to string\n` +
    `                if let date = schedule["at"] as? Date {\n` +
    `                    let dateString = ISO8601DateFormatter().string(from: date)\n` +
    `                    schedule["at"] = dateString\n` +
    `                }\n` +
    `\n` +
    `                notification["schedule"] = schedule\n` +
    `            }\n` +
    `        }\n` +
    `\n` +
    `        return notification\n` +
    `\n` +
    `    }\n` +
    `\n` +
    `    private func makeJSObject(from dictionary: [AnyHashable: Any]?) -> JSObject? {\n` +
    `        guard let dictionary else {\n` +
    `            return nil\n` +
    `        }\n` +
    `\n` +
    `        var result = JSObject()\n` +
    `        for (key, value) in dictionary {\n` +
    `            guard let stringKey = key as? String else {\n` +
    `                continue\n` +
    `            }\n` +
    `\n` +
    `            if let jsValue = makeJSValue(from: value) {\n` +
    `                result[stringKey] = jsValue\n` +
    `            }\n` +
    `        }\n` +
    `\n` +
    `        return result\n` +
    `    }\n` +
    `\n` +
    `    private func makeJSValue(from value: Any) -> JSValue? {\n` +
    `        switch value {\n` +
    `        case let string as String:\n` +
    `            return string\n` +
    `        case let bool as Bool:\n` +
    `            return bool\n` +
    `        case let int as Int:\n` +
    `            return int\n` +
    `        case let float as Float:\n` +
    `            return float\n` +
    `        case let double as Double:\n` +
    `            return double\n` +
    `        case let number as NSNumber:\n` +
    `            return number\n` +
    `        case let date as Date:\n` +
    `            return date\n` +
    `        case is NSNull:\n` +
    `            return NSNull()\n` +
    `        case let array as [Any]:\n` +
    `            return makeJSArray(from: array)\n` +
    `        case let dictionary as [AnyHashable: Any]:\n` +
    `            return makeJSObject(from: dictionary)\n` +
    `        default:\n` +
    `            return nil\n` +
    `        }\n` +
    `    }\n` +
    `\n` +
    `    private func makeJSArray(from array: [Any]) -> JSArray {\n` +
    `        var result = JSArray()\n` +
    `        for value in array {\n` +
    `            if let jsValue = makeJSValue(from: value) {\n` +
    `                result.append(jsValue)\n` +
    `            }\n` +
    `        }\n` +
    `\n` +
    `        return result\n` +
    `    }\n`,
};

function replaceAll(source: string, search: string, replacement: string): { updated: string; count: number } {
  const sourceParts = source.split(search);
  const count = sourceParts.length - 1;
  if (count <= 0) {
    return { updated: source, count: 0 };
  }

  return { updated: sourceParts.join(replacement), count };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isPluginSwiftPatched(source: string): boolean {
  return (
    REQUIRED_PATCHED_PATTERNS.every((pattern) => source.includes(pattern)) &&
    FORBIDDEN_PATCHED_PATTERNS.every((pattern) => !source.includes(pattern))
  );
}

assert(existsSync(PACKAGE_FILE), `Missing local-notifications package: ${PACKAGE_FILE}`);
assert(existsSync(TARGET_FILE), `Missing local-notifications Swift source: ${TARGET_FILE}`);
assert(existsSync(HANDLER_FILE), `Missing local-notifications Swift source: ${HANDLER_FILE}`);

const pluginPackage = JSON.parse(readFileSync(PACKAGE_FILE, "utf8")) as { version?: string };
const pluginVersion = pluginPackage.version ?? "unknown";
const pluginMajor = Number.parseInt(pluginVersion.split(".")[0] ?? "", 10);

assert(Number.isFinite(pluginMajor), `Unable to parse @capacitor/local-notifications version: ${pluginVersion}`);
assert(pluginMajor === 8, `Unsupported @capacitor/local-notifications major version ${pluginMajor}; expected 8.x`);

let pluginOriginal = readFileSync(TARGET_FILE, "utf8");
let pluginUpdated = pluginOriginal;
let pluginChanges = 0;
for (const [search, replacement] of SWIFT_REPLACEMENTS) {
  const result = replaceAll(pluginUpdated, search, replacement);
  pluginUpdated = result.updated;
  pluginChanges += result.count;
}

const pluginHadKnownLegacyPattern = LEGACY_PLUGIN_PATTERNS.some((pattern) =>
  pluginOriginal.includes(pattern),
);
const pluginLooksPatched = isPluginSwiftPatched(pluginUpdated);

assert(
  pluginHadKnownLegacyPattern || pluginLooksPatched,
  "Unsupported LocalNotificationsPlugin.swift layout; patch script needs to be updated for the installed plugin version.",
);

if (pluginUpdated !== pluginOriginal) {
  writeFileSync(TARGET_FILE, pluginUpdated);
  console.log(`Patched ${TARGET_FILE} (${pluginChanges} replacements, @capacitor/local-notifications ${pluginVersion})`);
} else {
  console.log(`No LocalNotificationsPlugin.swift changes needed (@capacitor/local-notifications ${pluginVersion})`);
}

assert(pluginLooksPatched, "LocalNotificationsPlugin.swift patch verification failed.");

const handlerOriginal = readFileSync(HANDLER_FILE, "utf8");
let handlerUpdated = handlerOriginal;
if (!handlerUpdated.includes("private func makeJSObject(from")) {
  const result = replaceAll(handlerUpdated, HANDLER_PATCH.search, HANDLER_PATCH.replace);
  assert(
    result.count > 0,
    "Unable to patch LocalNotificationsHandler.swift; expected source pattern was not found.",
  );
  handlerUpdated = result.updated;
}

if (handlerUpdated !== handlerOriginal) {
  writeFileSync(HANDLER_FILE, handlerUpdated);
  console.log(`Patched ${HANDLER_FILE}`);
} else {
  console.log(`No LocalNotificationsHandler.swift changes needed`);
}

assert(
  handlerUpdated.includes("private func makeJSObject(from"),
  "LocalNotificationsHandler.swift patch verification failed.",
);
