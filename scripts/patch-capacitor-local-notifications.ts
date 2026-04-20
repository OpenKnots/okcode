import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT_DIR = resolve(process.cwd());
const TARGET_FILE = resolve(
  ROOT_DIR,
  "node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsPlugin.swift",
);
const HANDLER_FILE = resolve(
  ROOT_DIR,
  "node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsHandler.swift",
);

const REPLACEMENTS: ReadonlyArray<[string, string]> = [
  [
    [
      '        guard let notifications = call.getArray("notifications", JSObject.self) else {\n',
      '            call.reject("Must provide notifications array as notifications option")\n',
      "            return\n",
      "        }\n",
    ].join(""),
    [
      '        guard let notifications = call.getArray("notifications")?.compactMap({ $0 as? JSObject }) else {\n',
      '            call.reject("Must provide notifications array as notifications option")\n',
      "            return\n",
      "        }\n",
    ].join(""),
  ],
  [
    [
      '        guard let notifications = call.getArray("notifications", JSObject.self), notifications.count > 0 else {\n',
      '            call.reject("Must supply notifications to cancel")\n',
      "            return\n",
      "        }\n",
    ].join(""),
    [
      '        guard let notifications = call.getArray("notifications")?.compactMap({ $0 as? JSObject }), notifications.count > 0 else {\n',
      '            call.reject("Must supply notifications to cancel")\n',
      "            return\n",
      "        }\n",
    ].join(""),
  ],
  [
    [
      '        guard let types = call.getArray("types", JSObject.self) else {\n',
      "            return\n",
      "        }\n",
    ].join(""),
    [
      '        guard let types = call.getArray("types")?.compactMap({ $0 as? JSObject }) else {\n',
      "            return\n",
      "        }\n",
    ].join(""),
  ],
  [
    [
      '        guard let notifications = call.getArray("notifications", JSObject.self) else {\n',
      '            call.reject("Must supply notifications to remove")\n',
      "            return\n",
      "        }\n",
    ].join(""),
    [
      '        guard let notifications = call.getArray("notifications")?.compactMap({ $0 as? JSObject }) else {\n',
      '            call.reject("Must supply notifications to remove")\n',
      "            return\n",
      "        }\n",
    ].join(""),
  ],
  [
    [
      '        guard let notifications = call.getArray("notifications", JSObject.self), notifications.count > 0 else {\n',
      '            call.reject("Must supply notifications to remove")\n',
      "            return\n",
      "        }\n",
    ].join(""),
    [
      '        guard let notifications = call.getArray("notifications")?.compactMap({ $0 as? JSObject }), notifications.count > 0 else {\n',
      '            call.reject("Must supply notifications to remove")\n',
      "            return\n",
      "        }\n",
    ].join(""),
  ],
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

if (!existsSync(TARGET_FILE)) {
  console.log(`Skipping Capacitor local-notifications patch; missing file: ${TARGET_FILE}`);
  process.exit(0);
}

for (const targetFile of [TARGET_FILE, HANDLER_FILE]) {
  if (!existsSync(targetFile)) {
    console.log(`Skipping Capacitor local-notifications patch; missing file: ${targetFile}`);
    continue;
  }

  const original = readFileSync(targetFile, "utf8");
  let updated = original;

  if (targetFile === TARGET_FILE) {
    for (const [pattern, replacement] of REPLACEMENTS) {
      updated = updated.replace(pattern, replacement);
    }
  } else if (!updated.includes("private func makeJSObject(from")) {
    updated = updated.replace(HANDLER_PATCH.search, HANDLER_PATCH.replace);
  }

  if (updated !== original) {
    writeFileSync(targetFile, updated);
    console.log(`Patched ${targetFile}`);
  } else {
    console.log(`No patch needed for ${targetFile}`);
  }
}
