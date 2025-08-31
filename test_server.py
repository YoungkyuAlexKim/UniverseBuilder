import requests

try:
    response = requests.get('http://localhost:8000/docs', timeout=5)
    print(f"✅ Server is running! Status: {response.status_code}")
except requests.exceptions.RequestException as e:
    print(f"❌ Server not responding: {e}")

# 간단한 API 테스트
try:
    response = requests.get('http://localhost:8000/api/v1/projects', timeout=5)
    print(f"✅ API endpoint working! Status: {response.status_code}")
except requests.exceptions.RequestException as e:
    print(f"❌ API not working: {e}")
