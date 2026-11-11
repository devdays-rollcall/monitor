import json
import os
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor

from test_api import BASE_URL, request, token, wait_for_group


class AlertTest(unittest.TestCase):
    def call(self, method, key, observer=None, path="/api/v1/alert", alert_id=None):
        headers = {'Authorization': 'Bearer ' + key}
        if observer:
            headers['X-Observer-Key'] = observer
        if alert_id:
            headers['X-Alert-Id'] = alert_id
        req = urllib.request.Request(BASE_URL + path, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                body = response.read()
                return response.status, json.loads(body) if body else None
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def test_group_and_view_keys_share_warning_and_notification(self):
        group = token()
        status, _ = request('POST', group, {'sender_id': str(uuid.uuid4()), 'events': []})
        self.assertEqual(202, status)
        wait_for_group(group, 0)
        status, share = request('POST', group, path='/api/v1/share-links')
        self.assertEqual(201, status)
        view = share['token']

        status, initial = self.call('GET', group)
        self.assertEqual(200, status)
        self.assertFalse(initial['active'])
        self.assertEqual(initial, self.call('GET', view)[1])
        observers = [token() for _ in range(4)]
        for observer in observers:
            self.assertEqual(204, self.call('POST', view, observer, '/api/v1/observers')[0])
        self.assertEqual(204, self.call('POST', view, observers[0], '/api/v1/observers')[0])
        self.assertEqual((200, {'notified': True}), self.call('POST', view))
        current = self.call('GET', group)[1]
        self.assertTrue(current['active'])
        alert_id = current['alert_id']

        ntfy_url = os.environ.get('NTFY_TEST_URL', 'http://localhost:2586').rstrip('/')
        path = urllib.parse.urlsplit(initial['subscription_url']).path
        with urllib.request.urlopen(ntfy_url + path + '/json?poll=1', timeout=10) as response:
            messages = [json.loads(line) for line in response if line.strip()]
        self.assertEqual(1, len(messages))
        self.assertIn('проверить маршрут', messages[0]['message'])
        self.assertNotIn(group, str(messages))
        self.assertNotIn(view, str(messages))

        self.assertEqual(403, self.call('DELETE', view, token(), alert_id=alert_id)[0])
        with ThreadPoolExecutor(max_workers=2) as executor:
            votes = list(executor.map(lambda _: self.call('DELETE', view, observers[0], alert_id=alert_id), range(2)))
        status, first = votes[0]
        self.assertEqual(200, status)
        self.assertTrue(first['active'])
        self.assertEqual((1, 3, 4, True), (first['approvals'], first['required_approvals'], first['observers'], first['approved']))
        self.assertTrue(all(vote[1]['approvals'] == 1 for vote in votes))
        self.assertEqual(1, self.call('DELETE', view, observers[0], alert_id=alert_id)[1]['approvals'])
        self.assertTrue(self.call('DELETE', view, observers[1], alert_id=alert_id)[1]['active'])
        self.assertFalse(self.call('DELETE', view, observers[2], alert_id=alert_id)[1]['active'])
        self.assertFalse(self.call('GET', group)[1]['active'])
        self.assertEqual((200, {'notified': True}), self.call('POST', view))
        fresh = self.call('GET', view, observers[0])[1]
        self.assertEqual(0, fresh['approvals'])
        self.assertFalse(fresh['approved'])
        self.assertNotEqual(alert_id, fresh['alert_id'])
        self.assertEqual(409, self.call('DELETE', view, observers[0], alert_id=alert_id)[0])
        self.assertEqual(0, self.call('GET', view, observers[0])[1]['approvals'])
        self.assertEqual(404, self.call('GET', token())[0])
        self.assertEqual(401, self.call('GET', 'bad')[0])

    def test_single_registered_browser_cannot_clear_warning(self):
        group = token()
        status, _ = request('POST', group, {'sender_id': str(uuid.uuid4()), 'events': []})
        self.assertEqual(202, status)
        wait_for_group(group, 0)
        observer = token()
        self.assertEqual(204, self.call('POST', group, observer, '/api/v1/observers')[0])
        self.assertEqual((200, {'notified': True}), self.call('POST', group))
        alert_id = self.call('GET', group)[1]['alert_id']
        state = self.call('DELETE', group, observer, alert_id=alert_id)[1]
        self.assertTrue(state['active'])
        self.assertEqual((1, 1, 2), (state['observers'], state['approvals'], state['required_approvals']))


if __name__ == '__main__':
    unittest.main()
