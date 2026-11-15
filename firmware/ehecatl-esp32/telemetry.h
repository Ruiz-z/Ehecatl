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
