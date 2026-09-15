import urllib.request
import urllib.parse
import http.cookiejar
import re

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [
    ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'),
    ('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'),
    ('Accept-Language', 'en-US,en;q=0.5'),
]

login_url = 'https://nic.eu.org/arf/en/'
req = urllib.request.Request(login_url)
resp = opener.open(req)
print('Initial URL:', resp.geturl())
content = resp.read().decode('utf-8', errors='ignore')

csrf_match = re.search(r'name=["\']csrfmiddlewaretoken["\'] value=["\']([^"\']+)["\']', content)
if not csrf_match:
    print('No CSRF token found')
    exit(1)

csrf = csrf_match.group(1)
print(f'CSRF: {csrf[:10]}...')
for c in cj:
    print('Cookie:', c.name, c.value)

data = urllib.parse.urlencode({
    'csrfmiddlewaretoken': csrf,
    'handle': 'AK5350-FREE',
    'password': 'Ayxan20202020!',
    'next': '/arf/en/',
    'login': 'Login'
}).encode('utf-8')

post_url = resp.geturl()
post_req = urllib.request.Request(post_url, data=data, headers={
    'Referer': post_url,
    'Origin': 'https://nic.eu.org',
    'Content-Type': 'application/x-www-form-urlencoded'
})
try:
    login_resp = opener.open(post_req)
    login_content = login_resp.read().decode('utf-8', errors='ignore')
    print('Status:', login_resp.status)
    print('Final URL:', login_resp.geturl())
    with open('scripts/eu_dashboard.html', 'w', encoding='utf-8') as f:
        f.write(login_content)
    if 'Logout' in login_content or 'logout' in login_content:
        print('LOGIN SUCCESSFUL!')
    else:
        print('Logged in? Check output.')
except urllib.error.HTTPError as e:
    print('HTTPError:', e.code, e.reason)
    err_body = e.read().decode('utf-8', errors='ignore')
    print('Error body:', err_body[:500])
