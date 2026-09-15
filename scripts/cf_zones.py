import os
import json
import urllib.request
import re

path = os.path.expanduser(r'~\AppData\Roaming\xdg.config\.wrangler\config\default.toml')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

token_match = re.search(r'oauth_token\s*=\s*["\']([^"\']+)["\']', content)
if not token_match:
    print('No oauth token found')
    exit(1)

token = token_match.group(1)
print(f'Token found: {token[:6]}...{token[-4:]}')

url = 'https://api.cloudflare.com/client/v4/zones'
req = urllib.request.Request(url, headers={
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
})

try:
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode('utf-8'))
    print('Success:', data.get('success'))
    zones = data.get('result', [])
    print(f'Found {len(zones)} zones:')
    for z in zones:
        print(f"  - Name: {z.get('name')}, Status: {z.get('status')}, Plan: {z.get('plan', {}).get('name')}")
        print(f"    Nameservers: {z.get('name_servers')}")
except urllib.error.HTTPError as e:
    print('HTTPError:', e.code, e.reason)
    print(e.read().decode('utf-8'))
