import os
import json
import urllib.request
import re

path = os.path.expanduser(r'~\AppData\Roaming\xdg.config\.wrangler\config\default.toml')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

token_match = re.search(r'oauth_token\s*=\s*["\']([^"\']+)["\']', content)
token = token_match.group(1)

account_id = "e5ab35aceb469c763dcd78f7ca8b4dd2"
zone_name = "zterminal.eu.org"

url = 'https://api.cloudflare.com/client/v4/zones'
payload = {
    "account": {
        "id": account_id
    },
    "name": zone_name,
    "type": "full"
}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode('utf-8'),
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    },
    method='POST'
)

try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode('utf-8'))
    print('Zone creation response:')
    print(json.dumps(data, indent=2))
    zone_id = data['result']['id']
    nameservers = data['result']['name_servers']
    print(f'Zone ID: {zone_id}')
    print(f'Assigned Nameservers: {nameservers}')
except urllib.error.HTTPError as e:
    print('HTTPError:', e.code, e.reason)
    err_text = e.read().decode('utf-8')
    print('Body:', err_text)
