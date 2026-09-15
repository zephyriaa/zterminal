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
content = resp.read().decode('utf-8', errors='ignore')

csrf_match = re.search(r'name=["\']csrfmiddlewaretoken["\'] value=["\']([^"\']+)["\']', content)
csrf = csrf_match.group(1)

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
opener.open(post_req)

# Fetch new domain form
new_domain_url = 'https://nic.eu.org/arf/en/domain/new/'
nd_req = urllib.request.Request(new_domain_url, headers={'Referer': 'https://nic.eu.org/arf/en/'})
nd_resp = opener.open(nd_req)
nd_content = nd_resp.read().decode('utf-8', errors='ignore')

with open('scripts/new_domain_form.html', 'w', encoding='utf-8') as f:
    f.write(nd_content)

print('Saved new domain form. Length:', len(nd_content))
