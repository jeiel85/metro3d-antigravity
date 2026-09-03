# 🚇 METRO 3D SEOUL

> **수도권 전철 3D 실시간 주행 및 관제 디지털 트윈**  
> Seoul Metropolitan Subway 3D Digital Twin & Live Simulator

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-success?style=for-the-badge&logo=github)](https://jeiel85.github.io/metro3d-antigravity/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre%20GL-4.7-blue?style=for-the-badge&logo=maplibre)](https://maplibre.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=for-the-badge&logo=three.js)](https://threejs.org/)

---

## 🌟 주요 기능 (Key Features)

1. **서울 3D 빌딩 & 지형 (3D Urban Landscape)**
   - OpenFreeMap 3D Vector Tiles 기반의 서울 전역 3D 빌딩 익스트루전(Extrusion) 시각화
   - 3D 틸트/회전(Pitch/Bearing) 및 주/야간(Night/Day) 테마 전환

2. **수도권 전철 전 노선 시뮬레이션 (All Subway Lines & Trains)**
   - 1호선 ~ 9호선, 신분당선, 수인분당선, 공항철도, 경의중앙선, 경춘선, 우이신설선 등 24개 전 노선
   - 634개 전체 역사 정밀 좌표 및 노선별 궤도(Track) 네온 글로우 렌더링
   - 배차간격 기반의 수백 대 열차 실시간 가감속 및 정차 시뮬레이션 물리 엔진

3. **열차 추적 & 지하철 멍때리기 모드 (Train Tracking & Chill Mode)**
   - 임의의 열차 클릭 시 3인칭/1인칭 추적 카메라 자동 락온
   - 진행 방향(Bearing)을 따라 서울 시내 빌딩 숲을 질주하는 역동적인 카메라 뷰
   - ☕ **Chill Mode**: 일정 주기마다 랜덤 열차로 시점을 전환하며 감상하는 힐링 모드

4. **실시간 관제 HUD & 정보 패널**
   - 현재 주행 속도계 (km/h), 이전역 ➔ 다음역 잔여 거리 실시간 표기
   - 역 클릭 시 도착 예정 열차 및 혼잡도/승하차 분석 그래프 제공
   - 역 이름 실시간 검색 및 바로가기 플라이 뷰(Fly-to)

5. **자체 합성 앰비언스 사운드 (Generative Web Audio)**
   - 외부 음원 파일 없이 Web Audio API로 실시간 합성되는 전철 모터 험(Hum) 및 레일 주행 사운드 효과

---

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, CSS3 Glassmorphism
- **Map & 3D**: MapLibre GL JS, Three.js, OpenFreeMap Vector Tiles
- **Data Engine**: GeoJSON, Haversine Distance & Spline Segment Interpolator
- **Audio**: Web Audio API Synthesizer
- **Bundler**: Vite

---

## 🚀 로컬 실행 방법 (Getting Started)

```bash
# 저장소 클론
git clone https://github.com/jeiel85/metro3d-antigravity.git
cd metro3d-antigravity

# 의존성 패키지 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

---

## 🌐 라이브 데모 (Live Demo)
👉 **[https://jeiel85.github.io/metro3d-antigravity/](https://jeiel85.github.io/metro3d-antigravity/)**
