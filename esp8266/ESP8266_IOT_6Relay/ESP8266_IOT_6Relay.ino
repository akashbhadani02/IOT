#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>

// =====================================================
//  ESP8266 IoT - 6 Relay
//  Pins: D0 D1 D2 D5 D6 D7
//  No ArduinoJson library required.
// =====================================================

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* SERVER_URL = "https://iot-flame-chi.vercel.app";
const char* DEVICE_TOKEN = "PASTE_YOUR_DEVICE_TOKEN_HERE";

// Relay module is normally ACTIVE LOW.
// If your relay works opposite, change these two lines.
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

const uint8_t RELAY_PINS[6] = {D0, D1, D2, D5, D6, D7};
const char* PIN_NAMES[6] = {"D0", "D1", "D2", "D5", "D6", "D7"};
bool relayState[6] = {false, false, false, false, false, false};

unsigned long lastCommandPoll = 0;
const unsigned long COMMAND_INTERVAL = 1500;

unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 10000;

unsigned long lastWifiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 5000;

// -----------------------------------------------------
// Apply relay output
// -----------------------------------------------------
void setRelay(uint8_t index, bool state) {
  if (index >= 6) return;

  relayState[index] = state;
  digitalWrite(RELAY_PINS[index], state ? RELAY_ON : RELAY_OFF);

  Serial.print(PIN_NAMES[index]);
  Serial.print(" -> ");
  Serial.println(state ? "ON" : "OFF");
}

int pinIndex(const String& pin) {
  for (int i = 0; i < 6; i++) {
    if (pin == PIN_NAMES[i]) return i;
  }
  return -1;
}

// -----------------------------------------------------
// WiFi
// -----------------------------------------------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println();
  Serial.print("Connecting WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected");
    Serial.print("ESP IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("RSSI: ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println("WiFi connection failed");
  }
}

// -----------------------------------------------------
// HTTP helper
// -----------------------------------------------------
bool beginRequest(HTTPClient& http, WiFiClientSecure& client, const String& url) {
  client.setInsecure();
  http.setTimeout(8000);

  if (!http.begin(client, url)) {
    Serial.println("HTTP begin failed");
    return false;
  }

  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("Content-Type", "application/json");
  return true;
}

// -----------------------------------------------------
// Read one JSON boolean for a pin.
// Example: "pin":"D0","state":true
// -----------------------------------------------------
bool readPinState(const String& json, const String& pin, bool& state) {
  String key = "\"pin\":\"" + pin + "\"";
  int pinPos = json.indexOf(key);
  if (pinPos < 0) return false;

  int statePos = json.indexOf("\"state\":", pinPos);
  if (statePos < 0) return false;

  statePos += 8; // length of "state":
  while (statePos < (int)json.length() && json[statePos] == ' ') statePos++;

  if (json.startsWith("true", statePos)) {
    state = true;
    return true;
  }

  if (json.startsWith("false", statePos)) {
    state = false;
    return true;
  }

  return false;
}

// -----------------------------------------------------
// Poll server commands
// -----------------------------------------------------
void pollCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  HTTPClient http;

  String url = String(SERVER_URL) + "/api/devices/device/commands";

  if (!beginRequest(http, client, url)) return;

  Serial.println("GET commands...");
  int code = http.GET();

  if (code > 0) {
    String body = http.getString();

    Serial.print("HTTP: ");
    Serial.println(code);

    if (code == 200) {
      for (int i = 0; i < 6; i++) {
        bool state;
        if (readPinState(body, PIN_NAMES[i], state)) {
          if (state != relayState[i]) {
            setRelay(i, state);
          }
        }
      }
      Serial.println("Commands applied");
    } else {
      Serial.println(body);
    }
  } else {
    Serial.print("GET error: ");
    Serial.println(http.errorToString(code));
  }

  http.end();
}

// -----------------------------------------------------
// Heartbeat
// IMPORTANT: heartbeat does NOT send relay states.
// This prevents an old physical state from overwriting
// a new command stored by the dashboard before polling.
// -----------------------------------------------------
void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  HTTPClient http;

  String url = String(SERVER_URL) + "/api/devices/device/heartbeat";

  if (!beginRequest(http, client, url)) return;

  int code = http.POST("{\"status\":\"online\"}");

  if (code > 0) {
    Serial.print("Heartbeat HTTP: ");
    Serial.println(code);

    if (code != 200) {
      Serial.println(http.getString());
    }
  } else {
    Serial.print("Heartbeat error: ");
    Serial.println(http.errorToString(code));
  }

  http.end();
}

// -----------------------------------------------------
// Setup
// -----------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(300);

  Serial.println();
  Serial.println("================================");
  Serial.println("ESP8266 IoT 6 Relay Starting...");
  Serial.println("================================");

  // Start with all relays OFF.
  for (int i = 0; i < 6; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], RELAY_OFF);
    relayState[i] = false;
  }

  connectWiFi();
}

// -----------------------------------------------------
// Main loop
// -----------------------------------------------------
void loop() {
  unsigned long now = millis();

  if (now - lastWifiCheck >= WIFI_CHECK_INTERVAL) {
    lastWifiCheck = now;
    if (WiFi.status() != WL_CONNECTED) {
      connectWiFi();
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    if (now - lastCommandPoll >= COMMAND_INTERVAL) {
      lastCommandPoll = now;
      pollCommands();
    }

    if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
      lastHeartbeat = now;
      sendHeartbeat();
    }
  }

  delay(10);
}
