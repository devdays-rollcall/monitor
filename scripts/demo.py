import base64
import json
import os
import secrets
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone


def main():
    base_url = os.environ.get("MONITOR_URL", "http://localhost:8080").rstrip("/")
    token = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")
    members = [str(uuid.uuid4()) for _ in range(3)]
    start = datetime.now(timezone.utc) - timedelta(minutes=20)
    events = []

    for index, member in enumerate(members):
        for point in range(10):
            data = {
                "latitude": 43.3499 + point * 0.0006 + index * 0.0004,
                "longitude": 42.4453 + point * 0.0008 - index * 0.0003,
            }

            if point % 2 == 0:
                data.update({"accuracy_m": 8.5, "altitude_m": 1564 + point, "battery_percent": 90 - point})

            events.append({
                "id": str(uuid.uuid4()),
                "member_id": member,
                "type": "location",
                "recorded_at": (start + timedelta(minutes=point)).isoformat(),
                "data": data,
            })

    payload = json.dumps({"sender_id": members[0], "events": events}).encode()
    request = urllib.request.Request(
        f"{base_url}/api/v1/events",
        data=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        for attempt in range(2):
            with urllib.request.urlopen(request, timeout=15) as response:
                print(f"Отправка {attempt + 1}: {response.status} {response.read().decode()}")
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"Не удалось отправить события: {error}", file=sys.stderr)
        return 1

    print(f"Токен группы: {token}")
    print("Откройте карту после обработки событий worker.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
