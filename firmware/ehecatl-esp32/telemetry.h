#pragma once

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>

namespace ehecatl {

// Comparación por resta para tolerar el desbordamiento de millis().
inline bool elapsed(uint32_t now, uint32_t since, uint32_t interval) {
  return static_cast<uint32_t>(now - since) >= interval;
}

inline int pumpLevel(bool running, int activeLevel) { return running ? activeLevel : !activeLevel; }

class Pump {
  uint32_t bootMs_, stoppedAt_, startedAt_ = 0, durationMs_ = 0;
  int64_t bootEpoch_ = 0, expiresAt_ = 0;
  bool running_ = false, done_ = false;
  double actual_ = 0;
public:
  explicit Pump(uint32_t bootMs = 0) : bootMs_(bootMs), stoppedAt_(bootMs) {}
  bool running() const { return running_; }
  bool done() const { return done_; }
  double actualSeconds() const { return actual_; }
  bool cooling(uint32_t now) const { return !running_ && !elapsed(now, stoppedAt_, 300000); }
  void sync(uint32_t now, int64_t epoch) {
    if (!bootEpoch_ && epoch >= 1735689600) bootEpoch_ = epoch - static_cast<uint32_t>(now - bootMs_) / 1000;
  }
  bool start(uint32_t now, int64_t epoch, int64_t created, int64_t expires, unsigned seconds, bool wifi) {
    // Hora válida comprobada por el llamador; se fija una sola vez al sincronizar.
    if (!bootEpoch_) bootEpoch_ = epoch - static_cast<uint32_t>(now - bootMs_) / 1000;
    if (running_ || cooling(now) || !wifi || epoch <= 0 || created <= bootEpoch_ || created > epoch || expires <= epoch || seconds == 0) return false;
    durationMs_ = (seconds > 30 ? 30 : seconds) * 1000U;
    startedAt_ = now; expiresAt_ = expires; running_ = true; done_ = false; actual_ = 0;
    return true;
  }
  void tick(uint32_t now, int64_t epoch, bool wifi) {
    if (!running_) return;
    if (!wifi || epoch <= 0 || epoch >= expiresAt_ || elapsed(now, startedAt_, durationMs_)) {
      actual_ = static_cast<uint32_t>(now - startedAt_) / 1000.0;
      if (actual_ > durationMs_ / 1000.0) actual_ = durationMs_ / 1000.0;
      done_ = wifi && epoch > 0 && epoch < expiresAt_ && elapsed(now, startedAt_, durationMs_);
      running_ = false; stoppedAt_ = now;
    }
  }
};

// Contrato plano acotado. Rechaza escapes, campos repetidos y datos extra.
struct PumpCommand { char id[37]{}; int64_t created = 0, expires = 0; unsigned seconds = 0; };
inline int64_t utcSeconds(const char* text) {
  int y, m, d, h, minute, second, used = 0;
  if (std::sscanf(text, "%4d-%2d-%2dT%2d:%2d:%2d%n", &y, &m, &d, &h, &minute, &second, &used) != 6 || used != 19) return 0;
  if (y < 2025 || y > 2099 || m < 1 || m > 12 || d < 1 || h < 0 || h > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return 0;
  const int monthDays[] = {31,28,31,30,31,30,31,31,30,31,30,31};
  if (d > monthDays[m-1] + (m == 2 && y % 4 == 0)) return 0;
  const char* end = text + used;
  if (*end == '.') { ++end; unsigned digits = 0; while (*end >= '0' && *end <= '9') { ++end; ++digits; } if (!digits || digits > 3) return 0; }
  if (*end++ != 'Z' || *end) return 0;
  int days = 0;
  for (int year = 1970; year < y; ++year) days += 365 + (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0));
  for (int month = 1; month < m; ++month) days += monthDays[month-1] + (month == 2 && y % 4 == 0);
  return static_cast<int64_t>(days + d - 1) * 86400 + h * 3600 + minute * 60 + second;
}
inline bool parseCommand(const char* json, PumpCommand& command) {
  if (std::strlen(json) > 512) return false;
  const char* p = json;
  auto space = [&]() { while (*p == ' ' || *p == '\n' || *p == '\r' || *p == '\t') ++p; };
  auto quoted = [&](char* out, size_t capacity) {
    space(); if (*p++ != '"') return false;
    size_t n = 0;
    while (*p && *p != '"') { if (*p == '\\' || static_cast<unsigned char>(*p) < 32 || n + 1 >= capacity) return false; out[n++] = *p++; }
    out[n] = 0; if (*p != '"') return false; ++p; return true;
  };
  space(); if (*p++ != '{') return false;
  unsigned fields = 0;
  for (int i = 0; i < 4; ++i) {
    char key[24], value[40];
    if (!quoted(key, sizeof(key))) return false;
    space(); if (*p++ != ':') return false;
    unsigned flag;
    if (std::strcmp(key, "durationSeconds") == 0) {
      flag = 1; space(); unsigned n = 0;
      if (*p < '0' || *p > '9') return false;
      while (*p >= '0' && *p <= '9') { if (n > 10000) return false; n = n * 10 + static_cast<unsigned>(*p++ - '0'); }
      if (!n || n > 86400) return false;
      command.seconds = n;
    } else {
      if (!quoted(value, sizeof(value))) return false;
      if (std::strcmp(key, "id") == 0) {
        flag = 2;
        if (std::strlen(value) != 36) return false;
        for (int j = 0; j < 36; ++j) {
          const char c = value[j];
          if (j == 8 || j == 13 || j == 18 || j == 23) { if (c != '-') return false; }
          else if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) return false;
        }
        std::memcpy(command.id, value, 37);
      } else if (std::strcmp(key, "createdAt") == 0) { flag = 4; command.created = utcSeconds(value); if (!command.created) return false; }
      else if (std::strcmp(key, "expiresAt") == 0) { flag = 8; command.expires = utcSeconds(value); if (!command.expires) return false; }
      else return false;
    }
    if (fields & flag) return false;
    fields |= flag;
    space(); if (*p++ != (i == 3 ? '}' : ',')) return false;
  }
  space(); return !*p && fields == 15 && command.expires > command.created;
}

class Button {
  bool previous_ = false;
  bool stable_ = false;
  uint32_t changedAt_ = 0;
public:
  bool pressed(bool raw, uint32_t now) {
    if (raw != previous_) { previous_ = raw; changedAt_ = now; }
    if (!elapsed(now, changedAt_, 40) || raw == stable_) return false;
    stable_ = raw;
    return stable_;
  }
};

inline void uuidV4(uint8_t bytes[16], char output[37]) {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const char* hex = "0123456789abcdef";
  unsigned pos = 0;
  for (unsigned i = 0; i < 16; ++i) {
    if (i == 4 || i == 6 || i == 8 || i == 10) output[pos++] = '-';
    output[pos++] = hex[bytes[i] >> 4]; output[pos++] = hex[bytes[i] & 15];
  }
  output[pos] = '\0';
}

inline size_t encodeReading(char* output, size_t capacity, const char* id,
                            const char* measuredAt, int soil, int gas,
                            float temperature, float humidity) {
  if (soil < 0 || soil > 4095 || gas < 0 || gas > 4095) return 0;
  char air[96] = "";
  size_t used = 0;
  if (std::isfinite(temperature) && temperature >= -50 && temperature <= 80)
    used = static_cast<size_t>(std::snprintf(air, sizeof(air), ",\"airTemperature\":%.1f", static_cast<double>(temperature)));
  if (std::isfinite(humidity) && humidity >= 0 && humidity <= 100)
    std::snprintf(air + used, sizeof(air) - used, ",\"airHumidity\":%.1f", static_cast<double>(humidity));
  const int size = std::snprintf(output, capacity,
    "{\"readingId\":\"%s\",\"measuredAt\":\"%s\",\"soilMoistureRaw\":%d,\"mq2Raw\":%d%s}",
    id, measuredAt, soil, gas, air);
  return size > 0 && static_cast<size_t>(size) < capacity ? static_cast<size_t>(size) : 0;
}

enum class Delivery { accepted, retry, rejected, unauthorized };
inline Delivery delivery(int httpCode) {
  if (httpCode == 200) return Delivery::accepted;
  if (httpCode == 401 || httpCode == 403) return Delivery::unauthorized;
  if (httpCode < 0 || httpCode == 408 || httpCode == 425 || httpCode == 429 || httpCode >= 500)
    return Delivery::retry;
  return Delivery::rejected;
}
inline uint32_t retryDelay(uint8_t failures) {
  return failures >= 4 ? 60000 : (5000U << failures);
}

// HTTP sin TLS se limita al destino LAN explícito; no acepta usuario, rutas ni DNS.
inline bool decimal(const char*& cursor, unsigned max, unsigned& value) {
  const char* start = cursor;
  value = 0;
  if (*cursor < '0' || *cursor > '9') return false;
  while (*cursor >= '0' && *cursor <= '9') {
    const unsigned digit = static_cast<unsigned>(*cursor++ - '0');
    if (value > (max - digit) / 10) return false;
    value = value * 10 + digit;
  }
  return !(cursor - start > 1 && *start == '0');
}
inline bool privateHttpUrl(const char* url) {
  if (std::strncmp(url, "http://", 7) != 0) return false;
  const char* cursor = url + 7;
  unsigned octets[4];
  for (unsigned i = 0; i < 4; ++i) {
    if (!decimal(cursor, 255, octets[i])) return false;
    if (i < 3 && *cursor++ != '.') return false;
  }
  if (!(octets[0] == 10 || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31) ||
        (octets[0] == 192 && octets[1] == 168))) return false;
  if (*cursor == ':') {
    ++cursor; unsigned port;
    if (!decimal(cursor, 65535, port) || port == 0) return false;
  }
  return *cursor == '\0';
}

} // namespace ehecatl
