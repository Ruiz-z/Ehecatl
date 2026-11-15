// Ehécatl: adaptación del montaje DHT11 + FC28 de dos puntas + MQ2.
// Riego solo manual. Los límites se aplican aunque la API falle.
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>
#include <esp_random.h>
#include <time.h>
#include "telemetry.h"

#if __has_include("config.h")
#include "config.h"
constexpr bool hasPrivateConfig = true;
#else
#include "config.example.h"
constexpr bool hasPrivateConfig = false;
#endif

static_assert(EHECATL_SEND_INTERVAL_SECONDS >= 30 && EHECATL_SEND_INTERVAL_SECONDS <= 86400,
              "El intervalo debe estar entre 30 y 86400 segundos");

static_assert(EHECATL_PUMP_MAX_SECONDS == 30 && EHECATL_PUMP_COOLDOWN_SECONDS == 300,
              "Los límites duros de riego no se pueden cambiar");
static_assert(EHECATL_PUMP_ACTIVE_LEVEL == 0 || EHECATL_PUMP_ACTIVE_LEVEL == 1, "Polaridad inválida");
struct PumpResult { char id[37]; char status[8]; double seconds; };
QueueHandle_t commands, results;
ehecatl::Pump pump;
struct PumpView { bool running = false, cooling = true; char id[37] = ""; char status[40] = "Sin órdenes"; };
PumpView pumpView;
char lastCommandId[37] = "";
const char* lastPumpStatus = "Sin órdenes";
bool pumpHadRun = false;

constexpr uint32_t sampleIntervalMs = 2000;
constexpr uint32_t sendIntervalMs = EHECATL_SEND_INTERVAL_SECONDS * 1000U;
struct WireReading { char json[384]; };
struct NetworkStatus { int httpCode = 0; bool blocked = false; uint32_t accepted = 0; };
NetworkStatus statusSnapshot();

WebServer server(80);
DHT dht(EHECATL_DHT_PIN, DHT11);
QueueHandle_t readings;
portMUX_TYPE statusMutex = portMUX_INITIALIZER_UNLOCKED;
NetworkStatus networkStatus;
ehecatl::Button button;
bool active = false;
bool haveSample = false;
float airTemperature = NAN, airHumidity = NAN;
int soilRaw = 0, mq2Raw = 0;
uint32_t lastSample = 0, lastQueued = 0, dropped = 0;
bool clockReady = false;
bool transportConfigured = false;

NetworkStatus statusSnapshot() {
  portENTER_CRITICAL(&statusMutex);
  const NetworkStatus copy = networkStatus;
  portEXIT_CRITICAL(&statusMutex);
  return copy;
}

int readAdc(int pin) {
  uint32_t sum = 0;
  for (int i = 0; i < 10; ++i) sum += analogRead(pin);
  return static_cast<int>(sum / 10);
}

String airText(float value, const char* unit) {
  return std::isfinite(value) ? String(value, 1) + unit : "Sin lectura válida";
}

void handleRoot() {
  const NetworkStatus status = statusSnapshot();
  portENTER_CRITICAL(&statusMutex);
  const PumpView pumpStatus = pumpView;
  portEXIT_CRITICAL(&statusMutex);
  String html;
  html.reserve(2300);
  html = F("<!doctype html><html lang='es'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta http-equiv='refresh' content='4'><title>Ehécatl · Sensores</title><style>body{font:18px system-ui;max-width:760px;margin:32px auto;padding:16px;background:#f3f5ef}section{background:white;padding:16px;margin:16px 0;border-radius:12px}small{display:block}</style><h1>Ehécatl · Sensores de campo</h1>");
  html += active ? F("<p>Envío activado</p>") : F("<p>Envío pausado · pulsa el botón físico para iniciar.</p>");
  html += F("<section><h2>Lecturas locales</h2>");
  if (haveSample) {
    html += "<p>Temperatura del aire: " + airText(airTemperature, " °C") + "</p>";
    html += "<p>Humedad del aire: " + airText(airHumidity, " %") + "</p>";
    html += "<p>FC28 · ADC: " + String(soilRaw) + "</p><small>Índice relativo disponible en Ehécatl después de calibrar.</small>";
    html += "<p>MQ2 · ADC experimental: " + String(mq2Raw) + "</p><small>No es una medición de ppm ni una alarma validada.</small>";
  } else html += F("<p>Esperando la primera lectura.</p>");
  html += F("</section><section><h2>Conexión con Ehécatl</h2>");
  html += WiFi.status() == WL_CONNECTED ? F("<p>WiFi conectado</p>") : F("<p>Sin WiFi · reconectando</p>");
  if (!transportConfigured) html += F("<p>Falta configurar WiFi, clave o destino permitido en config.h.</p>");
  if (!clockReady) html += F("<p>Esperando hora UTC por NTP; todavía no se envían muestras.</p>");
  if (status.blocked) html += F("<p>Clave rechazada. Corrige config.h y reinicia el ESP32.</p>");
  html += "<p>Último resultado HTTP: " + String(status.httpCode) + " · Confirmadas: " + String(status.accepted) + "</p>";
  html += "<p>En cola: " + String(uxQueueMessagesWaiting(readings)) + " · Omitidas por cola llena: " + String(dropped) + "</p>";
  html += F("<small>Una muestra adicional puede estar enviándose o esperando reintento. Los pendientes se pierden al reiniciar.</small></section></html>");
  html += "<section><h2>Riego manual</h2><p>" + String(pumpStatus.running ? "Regando" : pumpStatus.cooling ? "En enfriamiento" : "Bomba apagada") + "</p><p>Última orden: " + String(pumpStatus.id) + " · " + pumpStatus.status + "</p><small>Versión beta. El riego es manual, el sistema nunca riega solo.</small></section>";
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "text/html; charset=utf-8", html);
}

// Solo la tarea de red llama esta función. Nunca modifica la salida de la bomba.
int commandRequest(const String& path, const String& payload, String& response) {
  WiFiClient client;
  WiFiClientSecure secure;
  HTTPClient http;
  const String base = EHECATL_API_BASE_URL;
  bool started;
  if (base.startsWith("https://")) { secure.setCACert(EHECATL_ROOT_CA); started = http.begin(secure, base + path); }
  else started = http.begin(client, base + path);
  int code = -1;
  if (started) {
    http.setConnectTimeout(3000); http.setTimeout(3000);
    http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
    http.addHeader("X-Device-Key", EHECATL_DEVICE_API_KEY);
    http.addHeader("Content-Type", "application/json");
    code = payload.length() ? http.POST(payload) : http.GET();
    if (code == 200 && !payload.length()) {
      // Cuerpo acotado antes de leer; no se permite transferencia sin longitud.
      const int length = http.getSize();
      if (length > 0 && length <= 512) response = http.getString();
    }
  }
  http.end();
  if (code == 401 || code == 403) {
    portENTER_CRITICAL(&statusMutex); networkStatus.blocked = true; portEXIT_CRITICAL(&statusMutex);
  }
  return code;
}

// Única tarea que utiliza HTTPClient. El bucle de sensores/botón nunca espera a HTTP.
void networkTask(void*) {
  WireReading pending{};
  bool hasPending = false, ntpStarted = false, hasResult = false;
  PumpResult pendingResult{};
  uint32_t lastPoll = 0;
  uint8_t failures = 0;
  uint32_t lastAttempt = 0, waitMs = 0, lastReconnect = millis();
  for (;;) {
    const uint32_t now = millis();
    if (WiFi.status() != WL_CONNECTED) {
      if (ehecatl::elapsed(now, lastReconnect, 15000)) {
        lastReconnect = now;
        WiFi.reconnect();
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }
    if (!ntpStarted) {
      configTime(0, 0, EHECATL_NTP_SERVER_1, EHECATL_NTP_SERVER_2);
      ntpStarted = true;
      Serial.print("Página local: http://"); Serial.println(WiFi.localIP());
    }
    if (!transportConfigured || statusSnapshot().blocked) {
      vTaskDelay(pdMS_TO_TICKS(1000));
      continue;
    }
    if (ehecatl::elapsed(millis(), lastPoll, 5000) && time(nullptr) >= 1735689600) {
      lastPoll = millis();
      if (!hasResult) hasResult = xQueueReceive(results, &pendingResult, 0) == pdTRUE;
      String response;
      if (hasResult) {
        char payload[96];
        snprintf(payload, sizeof(payload), "{\"status\":\"%s\",\"actualSeconds\":%.3f}", pendingResult.status, pendingResult.seconds);
        const int code = commandRequest(String("/device/commands/") + pendingResult.id + "/result", payload, response);
        if (code == 200 || (code >= 400 && code < 500 && code != 408 && code != 425 && code != 429)) hasResult = false;
      } else if (uxQueueMessagesWaiting(commands) == 0) {
        const int code = commandRequest("/device/commands/next", "", response);
        ehecatl::PumpCommand command{};
        if (code == 200 && ehecatl::parseCommand(response.c_str(), command)) xQueueSend(commands, &command, 0);
      }
    }
    if (!hasPending) {
      hasPending = xQueueReceive(readings, &pending, pdMS_TO_TICKS(100)) == pdTRUE;
      if (!hasPending) continue;
    }
    if (!ehecatl::elapsed(now, lastAttempt, waitMs)) { vTaskDelay(pdMS_TO_TICKS(100)); continue; }

    WiFiClient localClient;
    WiFiClientSecure secureClient;
    HTTPClient http;
    const String base = EHECATL_API_BASE_URL;
    bool started;
    if (base.startsWith("https://")) {
      secureClient.setCACert(EHECATL_ROOT_CA);
      started = http.begin(secureClient, base + "/readings");
    } else started = http.begin(localClient, base + "/readings");
    int code = -1;
    if (started) {
      http.setConnectTimeout(3000);
      http.setTimeout(3000);
      http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-Device-Key", EHECATL_DEVICE_API_KEY);
      code = http.POST(reinterpret_cast<uint8_t*>(pending.json), std::strlen(pending.json));
    }
    http.end();
    const ehecatl::Delivery result = ehecatl::delivery(code);
    portENTER_CRITICAL(&statusMutex);
    networkStatus.httpCode = code;
    if (result == ehecatl::Delivery::accepted) ++networkStatus.accepted;
    if (result == ehecatl::Delivery::unauthorized) networkStatus.blocked = true;
    portEXIT_CRITICAL(&statusMutex);
    Serial.printf("[API] HTTP %d%s\n", code, result == ehecatl::Delivery::retry ? " · se reintentará la misma muestra" : "");
    if (result == ehecatl::Delivery::retry) {
      waitMs = ehecatl::retryDelay(failures);
      if (failures < 4) ++failures;
    } else {
      // No cambiar ID ni fecha de muestras rechazadas para ocultar el rechazo.
      hasPending = false; failures = 0; waitMs = 1000;
    }
    lastAttempt = millis();
  }
}

void queueReading() {
  time_t epoch = time(nullptr);
  clockReady = epoch >= 1735689600 && epoch < 4102444800LL;
  if (!clockReady || !transportConfigured || statusSnapshot().blocked) return;
  struct tm utc;
  gmtime_r(&epoch, &utc);
  char measuredAt[25];
  strftime(measuredAt, sizeof(measuredAt), "%Y-%m-%dT%H:%M:%SZ", &utc);
  uint8_t random[16]; char readingId[37];
  esp_fill_random(random, sizeof(random));
  ehecatl::uuidV4(random, readingId);
  WireReading sample{};
  if (!ehecatl::encodeReading(sample.json, sizeof(sample.json), readingId, measuredAt, soilRaw, mq2Raw, airTemperature, airHumidity)) {
    Serial.println("[Sensor] Muestra inválida; no se encola."); return;
  }
  if (xQueueSend(readings, &sample, 0) != pdTRUE) {
    ++dropped; Serial.println("[API] Cola llena; se omite muestra nueva.");
  }
}

// Prioridad separada: sensores, página local y HTTP no retrasan el apagado.
void pumpTask(void*) {
  for (;;) {
    const uint32_t now = millis();
    const time_t epoch = time(nullptr);
    const bool wifi = WiFi.status() == WL_CONNECTED && !statusSnapshot().blocked;
    pump.sync(now, epoch);
    pump.tick(now, epoch, wifi);
    digitalWrite(EHECATL_PUMP_PIN, ehecatl::pumpLevel(pump.running(), EHECATL_PUMP_ACTIVE_LEVEL));
    if (pumpHadRun && !pump.running()) {
      PumpResult result{};
      std::memcpy(result.id, lastCommandId, sizeof(result.id));
      std::strcpy(result.status, pump.done() ? "DONE" : "FAILED");
      result.seconds = pump.actualSeconds();
      xQueueSend(results, &result, 0);
      lastPumpStatus = pump.done() ? "Terminada" : "Interrumpida";
      pumpHadRun = false;
    }
    ehecatl::PumpCommand command{};
    if (!pump.running() && uxQueueMessagesWaiting(results) == 0 && xQueueReceive(commands, &command, 0) == pdTRUE) {
      const bool freshId = std::strcmp(lastCommandId, command.id) != 0;
      std::memcpy(lastCommandId, command.id, sizeof(lastCommandId));
      if (freshId && epoch >= 1735689600 && pump.start(now, epoch, command.created, command.expires, command.seconds, wifi)) {
        digitalWrite(EHECATL_PUMP_PIN, EHECATL_PUMP_ACTIVE_LEVEL);
        pumpHadRun = true; lastPumpStatus = "Regando";
      } else {
        PumpResult result{};
        std::memcpy(result.id, command.id, sizeof(result.id)); std::strcpy(result.status, "FAILED");
        xQueueSend(results, &result, 0); lastPumpStatus = "Rechazada por seguridad";
      }
    }
    portENTER_CRITICAL(&statusMutex);
    pumpView.running = pump.running(); pumpView.cooling = pump.cooling(now);
    std::memcpy(pumpView.id, lastCommandId, sizeof(pumpView.id));
    std::snprintf(pumpView.status, sizeof(pumpView.status), "%s", lastPumpStatus);
    portEXIT_CRITICAL(&statusMutex);
    vTaskDelay(1);
  }
}

void setup() {
  digitalWrite(EHECATL_PUMP_PIN, ehecatl::pumpLevel(false, EHECATL_PUMP_ACTIVE_LEVEL));
  pinMode(EHECATL_PUMP_PIN, OUTPUT);
  Serial.begin(115200);
  pinMode(EHECATL_BUTTON_PIN, INPUT_PULLUP);
  dht.begin();
  analogReadResolution(12);
  commands = xQueueCreate(1, sizeof(ehecatl::PumpCommand));
  results = xQueueCreate(1, sizeof(PumpResult));
  readings = xQueueCreate(8, sizeof(WireReading));
  if (!readings || !commands || !results) { Serial.println("No se pudo crear la cola; reinicia el dispositivo."); for (;;) delay(1000); }
  const bool https = String(EHECATL_API_BASE_URL).startsWith("https://") && std::strlen(EHECATL_ROOT_CA) > 0;
  const bool localHttp = EHECATL_ALLOW_PRIVATE_HTTP && ehecatl::privateHttpUrl(EHECATL_API_BASE_URL);
  transportConfigured = hasPrivateConfig && std::strlen(EHECATL_WIFI_SSID) > 0 &&
    std::strlen(EHECATL_DEVICE_API_KEY) == 43 && (https || localHttp);
  if (!transportConfigured) Serial.println("Configura config.h. Las credenciales nunca se muestran en pantalla ni en Serial.");
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  if (std::strlen(EHECATL_WIFI_SSID)) WiFi.begin(EHECATL_WIFI_SSID, EHECATL_WIFI_PASSWORD);
  server.on("/", handleRoot);
  server.begin();
  if (xTaskCreate(pumpTask, "ehecatl-pump", 4096, nullptr, 3, nullptr) != pdPASS)
    Serial.println("No se pudo iniciar control de bomba; permanece apagada.");
  if (xTaskCreate(networkTask, "ehecatl-network", 8192, nullptr, 1, nullptr) != pdPASS)
    Serial.println("No se pudo iniciar la red; reinicia el dispositivo.");
  lastSample = millis() - sampleIntervalMs;
  Serial.println("Ehécatl listo. Pulsa GPIO12 para iniciar envíos. Bomba desactivada.");
}

void loop() {
  const uint32_t now = millis();
  server.handleClient();
  if (button.pressed(digitalRead(EHECATL_BUTTON_PIN) == LOW, now)) {
    active = !active;
    lastQueued = now - sendIntervalMs;
    Serial.println(active ? "Envío activado." : "Envío pausado; pendientes previos siguen su entrega.");
  }
  if (ehecatl::elapsed(now, lastSample, sampleIntervalMs)) {
    lastSample = now;
    airTemperature = dht.readTemperature();
    airHumidity = dht.readHumidity();
    soilRaw = readAdc(EHECATL_SOIL_PIN);
    mq2Raw = readAdc(EHECATL_MQ2_PIN);
    haveSample = true;
    clockReady = time(nullptr) >= 1735689600 && time(nullptr) < 4102444800LL;
    Serial.printf("[Sensor] FC28 ADC=%d · MQ2 ADC=%d · Aire %s / %s\n", soilRaw, mq2Raw,
                  airText(airTemperature, " C").c_str(), airText(airHumidity, " %").c_str());
    if (active && clockReady && ehecatl::elapsed(now, lastQueued, sendIntervalMs)) {
      queueReading(); lastQueued = now;
    }
  }
  delay(2);
}
