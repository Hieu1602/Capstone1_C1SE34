import httpx
import time

base = 'http://localhost:8000'
for i in range(20):
    try:
        r = httpx.get(f'{base}/health', timeout=5)
        print('HEALTH', r.status_code, r.text)
        break
    except Exception as e:
        print('WAIT', i, type(e).__name__, e)
        time.sleep(2)
else:
    raise SystemExit('backend not ready')

body = {'full_name': 'Test User', 'phone': '+84901234567', 'password': 'Abcdef12!', 'role': 'caregiver'}
r = httpx.post(f'{base}/api/v1/auth/register', json=body, timeout=20)
print('REGISTER', r.status_code)
print(r.text)

resp = httpx.post(f'{base}/api/v1/auth/login', data={'username': '+84901234567', 'password': 'Abcdef12!'}, timeout=20)
print('LOGIN', resp.status_code)
print(resp.text)
