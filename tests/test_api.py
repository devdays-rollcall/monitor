import base64
import hashlib
import json
import os
import re
import secrets
import subprocess
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone


BASE_URL = os.environ.get("MONITOR_URL", "http://localhost:8080").rstrip("/")


def token():
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")


def event(member=None, latitude=43.35):
    return {
        "id": str(uuid.uuid4()),
        "member_id": member or str(uuid.uuid4()),
        "type": "location",
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "data": {"latitude": latitude, "longitude": 42.44},
    }


def request(method, group_token=None, body=None, query=None):
    url = BASE_URL + "/api/v1/events"

    if query:
        url += "?" + urllib.parse.urlencode(query)

    headers = {}

    if group_token is not None:
        headers["Authorization"] = "Bearer " + group_token

    data = None

    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()

    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def wait_for_group(group_token, expected):
    deadline = time.monotonic() + 50

    while time.monotonic() < deadline:
        try:
            status, body = request("GET", group_token)
        except (urllib.error.URLError, TimeoutError, ValueError):
            time.sleep(0.5)
            continue

        if status == 200 and len(body["events"]) == expected:
            return body

        time.sleep(0.5)

    raise AssertionError(f"group did not reach {expected} events")


def wait_for_queue():
    deadline = time.monotonic() + 20
    heartbeat = {"sender_id": str(uuid.uuid4()), "events": []}

    while time.monotonic() < deadline:
        try:
            if request("POST", token(), heartbeat)[0] == 202:
                return
        except (urllib.error.URLError, TimeoutError, ValueError):
            pass

        time.sleep(0.5)

    raise AssertionError("event queue did not recover")


def nats_command(wire):
    process = subprocess.Popen(
        ["docker", "compose", "exec", "-T", "nats", "nc", "-w", "1", "127.0.0.1", "4222"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    process.stdin.write(wire)
    process.stdin.flush()
    time.sleep(0.2)
    reply, error = process.communicate(timeout=5)

    if process.returncode:
        raise RuntimeError(error.decode())

    return reply


class HttpContractTest(unittest.TestCase):
    def test_batch_limit(self):
        group_token = token()
        sender = str(uuid.uuid4())
        points = [event(sender) for _ in range(500)]

        self.assertEqual((202, {"accepted": 500}), request("POST", group_token, {"sender_id": sender, "events": points}))
        self.assertEqual(500, len(wait_for_group(group_token, 500)["events"]))
        self.assertEqual(400, request("POST", group_token, {"sender_id": sender, "events": points + [event(sender)]})[0])

    def test_concurrent_batches_for_one_group(self):
        group_token = token()
        sender = str(uuid.uuid4())
        points = [event(sender) for _ in range(20)]

        def publish(point):
            return request("POST", group_token, {"sender_id": sender, "events": [point]})[0]

        with ThreadPoolExecutor(max_workers=8) as executor:
            self.assertEqual([202] * len(points), list(executor.map(publish, points)))

        saved = wait_for_group(group_token, len(points))["events"]
        self.assertEqual({point["id"] for point in points}, {point["id"] for point in saved})

    def test_batch_deduplication_pagination_and_group_isolation(self):
        group_token = token()
        sender = str(uuid.uuid4())
        points = [event(sender), event(), event()]
        points[0]["data"].update({"battery_percent": 0, "extra": "preserved", "empty": "also preserved"})
        batch = {"sender_id": sender, "events": points}

        self.assertEqual(404, request("GET", group_token)[0])
        self.assertEqual((202, {"accepted": 3}), request("POST", group_token, batch))
        self.assertEqual((202, {"accepted": 3}), request("POST", group_token, batch))
        saved = wait_for_group(group_token, 3)

        self.assertEqual("preserved", saved["events"][0]["data"]["extra"])
        self.assertEqual("also preserved", saved["events"][0]["data"]["empty"])
        self.assertEqual(0, saved["events"][0]["data"]["battery_percent"])
        self.assertNotIn("speed_mps", saved["events"][0]["data"])
        self.assertIsNone(saved["next_cursor"])

        pages = []
        cursor = None

        while True:
            query = {"limit": 1}

            if cursor:
                query["cursor"] = cursor

            status, body = request("GET", group_token, query=query)
            self.assertEqual(200, status)
            pages.extend(body["events"])
            cursor = body["next_cursor"]

            if cursor is None:
                break

        self.assertEqual([point["id"] for point in points], [point["id"] for point in pages])
        self.assertEqual(404, request("GET", token())[0])

        changed = json.loads(json.dumps(points[0]))
        changed["data"]["latitude"] = 44
        started = datetime.now(timezone.utc).isoformat()
        self.assertEqual(202, request("POST", group_token, {"sender_id": sender, "events": [changed]})[0])
        deadline = time.monotonic() + 10

        while time.monotonic() < deadline:
            logs = subprocess.check_output(["docker", "compose", "logs", "--since", started, "worker"], text=True)

            if "event conflict" in logs and changed["id"] in logs:
                break

            time.sleep(0.2)
        else:
            self.fail("event conflict was not logged")

        self.assertEqual(points[0]["data"]["latitude"], request("GET", group_token)[1]["events"][0]["data"]["latitude"])

    def test_heartbeat_records_direct_contact(self):
        group_token = token()
        sender = str(uuid.uuid4())
        self.assertEqual((202, {"accepted": 0}), request("POST", group_token, {"sender_id": sender, "events": []}))
        self.assertEqual([], wait_for_group(group_token, 0)["events"])
        digest = hashlib.sha256(group_token.encode()).hexdigest()
        sql = f"select m.last_direct_contact_at is not null and g.last_contact_at is not null from members m join groups g on g.id = m.group_id where g.token_hash = decode('{digest}', 'hex') and m.member_id = '{sender}'::uuid"
        output = subprocess.check_output(["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "user", "-d", "monitordb", "-Atc", sql], text=True)
        self.assertEqual("t", output.strip())

    def test_validation_rejects_whole_batch_and_bad_tokens(self):
        group_token = token()
        sender = str(uuid.uuid4())
        batch = {"sender_id": sender, "events": [event(sender), event(latitude=91)]}
        status, body = request("POST", group_token, batch)

        self.assertEqual(422, status)
        self.assertEqual("invalid_event", body["error"]["code"])
        self.assertEqual(404, request("GET", group_token)[0])
        self.assertEqual(401, request("GET")[0])
        self.assertEqual(400, request("GET", group_token, query={"limit": 1001})[0])

    def test_request_size_limit(self):
        group_token = token()
        point = event()
        point["data"]["padding"] = "x" * (1024 * 1024)
        status, body = request("POST", group_token, {"sender_id": str(uuid.uuid4()), "events": [point]})
        self.assertEqual(413, status)
        self.assertIn("error", body)


@unittest.skipUnless(os.environ.get("MONITOR_FAULT_TESTS") == "1", "set MONITOR_FAULT_TESTS=1 to stop and restart infrastructure")
class FaultRecoveryTest(unittest.TestCase):
    def test_invalid_queue_message_does_not_block_following_batches(self):
        wait_for_queue()

        for malformed in (b"{", b"null"):
            started = datetime.now(timezone.utc).isoformat()
            wire = b'CONNECT {"verbose":false}\r\nPUB group.events.batch ' + str(len(malformed)).encode() + b"\r\n" + malformed + b"\r\n"
            nats_command(wire)
            deadline = time.monotonic() + 10

            while time.monotonic() < deadline:
                logs = subprocess.check_output(["docker", "compose", "logs", "--since", started, "worker"], text=True)
                match = re.search(r"invalid queued message stream_sequence=(\d+)", logs)

                if match:
                    break

                time.sleep(0.2)
            else:
                self.fail("worker did not reject the malformed message")

            payload = json.dumps({"seq": int(match.group(1))}).encode()
            wire = b'CONNECT {"verbose":false}\r\nSUB _INBOX.inspect 1\r\nPUB $JS.API.STREAM.MSG.GET.GROUP_EVENTS _INBOX.inspect ' + str(len(payload)).encode() + b"\r\n" + payload + b"\r\n"
            reply = nats_command(wire)
            response = next(json.loads(line) for line in reply.splitlines() if line.startswith(b'{"type"'))
            self.assertEqual(malformed, base64.b64decode(response["message"]["data"]))

        group_token = token()
        sender = str(uuid.uuid4())
        self.assertEqual(202, request("POST", group_token, {"sender_id": sender, "events": [event(sender)]})[0])
        self.assertEqual(1, len(wait_for_group(group_token, 1)["events"]))

    def test_api_starts_when_queue_is_unavailable(self):
        sender = str(uuid.uuid4())
        subprocess.run(["docker", "compose", "stop", "nats"], check=True, capture_output=True)

        try:
            subprocess.run(["docker", "compose", "restart", "api"], check=True, capture_output=True)
            deadline = time.monotonic() + 20

            while time.monotonic() < deadline:
                try:
                    if request("GET")[0] == 401:
                        break
                except (urllib.error.URLError, TimeoutError, ValueError):
                    pass

                time.sleep(0.5)
            else:
                self.fail("API did not start while NATS was down")

            status, _ = request("POST", token(), {"sender_id": sender, "events": []})
            self.assertEqual(503, status)
        finally:
            subprocess.run(["docker", "compose", "start", "nats"], check=True, capture_output=True)
            wait_for_queue()

    def test_worker_and_database_outage(self):
        wait_for_queue()
        group_token = token()
        sender = str(uuid.uuid4())
        batch = {"sender_id": sender, "events": [event(sender)]}
        subprocess.run(["docker", "compose", "stop", "worker", "postgres"], check=True, capture_output=True)

        try:
            self.assertEqual(202, request("POST", group_token, batch)[0])
        finally:
            subprocess.run(["docker", "compose", "start", "postgres", "worker"], check=True, capture_output=True)

        self.assertEqual(1, len(wait_for_group(group_token, 1)["events"]))

    def test_database_failure_retries_delivery(self):
        wait_for_queue()
        group_token = token()
        sender = str(uuid.uuid4())
        batch = {"sender_id": sender, "events": [event(sender)]}
        started = datetime.now(timezone.utc).isoformat()
        subprocess.run(["docker", "compose", "stop", "postgres"], check=True, capture_output=True)

        try:
            self.assertEqual(202, request("POST", group_token, batch)[0])
            deadline = time.monotonic() + 15

            while time.monotonic() < deadline:
                logs = subprocess.check_output(["docker", "compose", "logs", "--since", started, "worker"], text=True)

                if "could not save batch" in logs:
                    break

                time.sleep(0.5)
            else:
                self.fail("worker did not attempt the batch while PostgreSQL was down")
        finally:
            subprocess.run(["docker", "compose", "start", "postgres"], check=True, capture_output=True)

        self.assertEqual(1, len(wait_for_group(group_token, 1)["events"]))

    def test_queue_outage_returns_no_success(self):
        sender = str(uuid.uuid4())
        subprocess.run(["docker", "compose", "stop", "nats"], check=True, capture_output=True)

        try:
            status, _ = request("POST", token(), {"sender_id": sender, "events": []})
            self.assertEqual(503, status)
        finally:
            subprocess.run(["docker", "compose", "start", "nats"], check=True, capture_output=True)
            wait_for_queue()


if __name__ == "__main__":
    unittest.main()
